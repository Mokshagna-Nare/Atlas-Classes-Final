import io
import os
import re
import zipfile
from dataclasses import dataclass
from typing import Dict, List, Optional

try:
    from mathml2latex import convert as mathml2latex_convert
except Exception:
    mathml2latex_convert = None

from lxml import etree
from olefile import OleFileIO

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"


@dataclass
class MathToken:
    kind: str
    latex: Optional[str]
    success: bool
    error: Optional[str] = None


class OmmlMathConverter:
    def __init__(self, xslt_path: str):
        if not os.path.exists(xslt_path):
            raise FileNotFoundError(f"OMML->MML XSLT not found: {xslt_path}")
        with open(xslt_path, "rb") as f:
            xslt_bytes = f.read()
        xslt_doc = etree.XML(xslt_bytes)
        self.transform = etree.XSLT(xslt_doc)

    def omml_node_to_mathml(self, omml_node: etree._Element) -> str:
        result = self.transform(omml_node)
        return str(result)

    def omml_to_latex(self, omml_node: etree._Element) -> Optional[str]:
        mathml = self.omml_node_to_mathml(omml_node)
        if mathml2latex_convert is None:
            return None

        try:
            latex = mathml2latex_convert(mathml)
        except Exception:
            return None

        if not latex or not isinstance(latex, str):
            return None

        latex = latex.strip()
        if not latex:
            return None

        return latex


class MtefToLatexConverter:
    def mtef_to_latex(self, mtef_bytes: bytes) -> Optional[str]:
        return None


class DocxMathExtractor:
    def __init__(self, xslt_path: str):
        self.omml_converter = OmmlMathConverter(xslt_path=xslt_path)
        self.mtef_converter = MtefToLatexConverter()

    def _read_doc_xml(self, docx_zip: zipfile.ZipFile) -> etree._Element:
        xml_bytes = docx_zip.read("word/document.xml")
        return etree.fromstring(xml_bytes)

    def _read_document_rels(self, docx_zip: zipfile.ZipFile) -> Dict[str, str]:
        rels_path = "word/_rels/document.xml.rels"
        if rels_path not in docx_zip.namelist():
            return {}

        rels_bytes = docx_zip.read(rels_path)
        rels_root = etree.fromstring(rels_bytes)

        mapping: Dict[str, str] = {}
        for rel in rels_root.findall(f"{{{PKG_REL_NS}}}Relationship"):
            rid = rel.get("Id")
            target = rel.get("Target")
            if rid and target:
                mapping[rid] = target
        return mapping

    def extract_math_tokens(self, docx_path: str) -> List[MathToken]:
        tokens: List[MathToken] = []

        with zipfile.ZipFile(docx_path, "r") as z:
            doc_root = self._read_doc_xml(z)
            rel_map = self._read_document_rels(z)

            ns = {
                "w": WORD_NS,
                "m": M_NS,
                "r": DOC_REL_NS,
                "v": "urn:schemas-microsoft-com:vml",
                "o": "urn:schemas-microsoft-com:office:office",
            }

            o_math_nodes = doc_root.xpath(".//m:oMath | .//m:oMathPara", namespaces=ns)
            for omml_node in o_math_nodes:
                target_node = omml_node
                if omml_node.tag.endswith("oMathPara"):
                    inner = omml_node.xpath(".//m:oMath", namespaces=ns)
                    if inner:
                        target_node = inner[0]

                try:
                    latex = self.omml_converter.omml_to_latex(target_node)
                    if latex:
                        tokens.append(MathToken(kind="omml", latex=f"$${latex}$$", success=True))
                    else:
                        tokens.append(MathToken(kind="omml", latex=None, success=False, error="OMML->LaTeX failed"))
                except Exception as e:
                    tokens.append(MathToken(kind="omml", latex=None, success=False, error=str(e)))

            object_nodes = doc_root.xpath(".//w:object", namespaces=ns)
            for obj in object_nodes:
                try:
                    rid = None

                    imagedata = obj.xpath(".//v:imagedata", namespaces=ns)
                    if imagedata:
                        rid = imagedata[0].get(f"{{{DOC_REL_NS}}}id")

                    if not rid:
                        ole_refs = obj.xpath(".//o:OLEObject", namespaces=ns)
                        if ole_refs:
                            rid = ole_refs[0].get(f"{{{DOC_REL_NS}}}id")

                    if not rid:
                        tokens.append(MathToken(kind="mathtype", latex=None, success=False, error="No rel id"))
                        continue

                    target = rel_map.get(rid)
                    if not target:
                        tokens.append(MathToken(kind="mathtype", latex=None, success=False, error="No rel target"))
                        continue

                    target_clean = target.replace("\\", "/").replace("../", "")
                    if target_clean.startswith("embeddings/"):
                        bin_path = f"word/{target_clean}"
                    elif target_clean.startswith("word/"):
                        bin_path = target_clean
                    else:
                        bin_path = f"word/{target_clean}"

                    if bin_path not in z.namelist():
                        tokens.append(MathToken(kind="mathtype", latex=None, success=False, error="OLE bin not found"))
                        continue

                    ole_bytes = z.read(bin_path)
                    with OleFileIO(io.BytesIO(ole_bytes)) as ole:
                        stream_name = None

                        if ole.exists("Equation Native"):
                            stream_name = "Equation Native"
                        else:
                            for s in ole.listdir():
                                flat = "/".join(s)
                                if "Equation" in flat:
                                    stream_name = s
                                    break

                        if not stream_name:
                            tokens.append(MathToken(kind="mathtype", latex=None, success=False, error="Equation stream missing"))
                            continue

                        mtef_data = ole.openstream(stream_name).read()
                        latex = self.mtef_converter.mtef_to_latex(mtef_data)

                        if latex:
                            tokens.append(MathToken(kind="mathtype", latex=f"$${latex}$$", success=True))
                        else:
                            tokens.append(MathToken(kind="mathtype", latex=None, success=False, error="MTEF->LaTeX failed"))

                except Exception as e:
                    tokens.append(MathToken(kind="mathtype", latex=None, success=False, error=str(e)))

        return tokens