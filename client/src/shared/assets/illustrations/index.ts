/**
 * unDraw illustrations (https://undraw.co/license), recolored at download to primary-600.
 * Allowed only in an empty state where nothing exists yet (D-057): never for a search or
 * filter miss, a dashboard, loading, or an error.
 */
import folderFilesSrc from "./folder-files.svg";
import openBookSrc from "./open-book.svg";
import readingSrc from "./reading.svg";

export interface Illustration {
  src: string;
  /** Intrinsic size, so the browser reserves the space before the file loads. */
  width: number;
  height: number;
}

export const openBook: Illustration = { src: openBookSrc, width: 866, height: 576 };
export const reading: Illustration = { src: readingSrc, width: 960, height: 512 };
export const folderFiles: Illustration = { src: folderFilesSrc, width: 844, height: 800 };
