/**
 * How the Versión Testigo is laid out as a book: section headings and where
 * paragraphs begin. Headings are an editorial aid, not part of the translated
 * text (STYLE.md §8). Keyed by book index; refs are "chapter:verse".
 */
export interface BookLayout {
  title: string;
  subtitle: string;
  headings: Record<string, string>;
  /** First verse of each paragraph (every chapter also starts one). */
  paragraphs: string[];
}

export const VT_LAYOUT: Record<number, BookLayout> = {
  7: {
    title: "Rut",
    subtitle: "Traducido del hebreo",
    headings: {
      "1:1": "Una familia de Belén en Moab",
      "1:6": "Rut se queda con Noemí",
      "1:19": "Noemí vuelve a Belén",
      "2:1": "Rut recoge espigas en el campo de Booz",
      "3:1": "Rut y Booz en la era",
      "4:1": "Booz redime la heredad de Elimelec",
      "4:13": "Nace Obed",
      "4:18": "Los antepasados de David",
    },
    paragraphs: [
      "1:1", "1:6", "1:8", "1:11", "1:14", "1:15", "1:16", "1:18", "1:19", "1:20", "1:22",
      "2:1", "2:2", "2:3", "2:4", "2:5", "2:6", "2:8", "2:10", "2:11", "2:13", "2:14", "2:15", "2:17", "2:18", "2:19", "2:20", "2:21", "2:22", "2:23",
      "3:1", "3:5", "3:6", "3:8", "3:10", "3:14", "3:15", "3:16", "3:17", "3:18",
      "4:1", "4:2", "4:3", "4:5", "4:6", "4:7", "4:8", "4:9", "4:11", "4:13", "4:14", "4:16", "4:17", "4:18",
    ],
  },
};
