declare module 'word-list-json' {
  interface WordList extends Array<string> {
    lengths: Record<string, number>;
  }
  const words: WordList;
  export default words;
}
