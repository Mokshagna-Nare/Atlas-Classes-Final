<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:mml="http://www.w3.org/1998/Math/MathML"
  exclude-result-prefixes="m">
  <!--
    NOTE:
    This is a minimal fallback stylesheet placeholder.
    If the full Microsoft OMML2MML.XSL is available, replace this file with the official one.
    For now, it attempts to preserve basic OMML structure by outputting MathML wrapper nodes.
  -->
  <xsl:output method="xml" indent="yes"/>

  <xsl:template match="m:oMath|m:oMathPara">
    <mml:math>
      <xsl:apply-templates select="*|text()"/>
    </mml:math>
  </xsl:template>

  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>
