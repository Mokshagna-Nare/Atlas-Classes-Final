# Word lists for the built-in reader's text checks

- `english_words.txt.gz`: 178,759 English dictionary words (incl. science terms).
  A word in this list is never changed by the joined-word fixer.
- `common_words.tsv.gz`: the 60,000 most frequent English words with counts. A joined
  word ("packagingin") is split only into words from this list.

Both come from the `wordsegment` package 1.3.1 (Apache License 2.0, Grant Jenks), whose counts
are derived from Google's Web Trillion Word Corpus (Peter Norvig, "Natural Language Corpus Data").
