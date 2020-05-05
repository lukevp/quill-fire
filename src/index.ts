/* eslint-disable operator-linebreak */
/* eslint-disable comma-dangle */
/* eslint-disable quotes */
// eslint-disable-next-line no-unused-vars
import Quill, { TextChangeHandler } from "quill";

type FireAction = () => string | void;

export interface FireItem {
  matchString: string;
  action: FireAction; // Action to be invoked.
  // TODO: support returning a Delta to build mention functionality.
  // If string is returned, adds string to contents.
  ignoreCase?: boolean;
  removeMatchingText?: boolean; // if false, will leave matching text but will fire.
  //  if true, will delete matching text before firing.
  prefix?: RegExp; // if a matchString is found,
  // ensures the given prefix regex matches before the string before firing.
  maxPrefixLookback?: number;
}

interface FireInternalItem {
  matchString: string;
  action: FireAction;
  ignoreCase: boolean;
  removeMatchingText: boolean;
  prefix?: RegExp;
  maxPrefixLookback: number;
  matchLength: number;
}

export interface FireOptions {
  locale?: string;
  items: FireItem[];
}
interface FireInternalOptions {
  locale?: string;
  items: FireInternalItem[];
}

class Fire {
  private quill: Quill;

  private options: FireInternalOptions;

  private longestItem: number;

  equalsIgnoringCase(text: string, other: string) {
    return (
      text.localeCompare(other, this.options.locale, {
        sensitivity: "base",
      }) === 0
    );
  }

  constructor(quill: Quill, options: FireOptions) {
    this.quill = quill;
    this.options = { items: [] };

    if (options && options.items && options.items.map) {
      this.options.items = options.items.map((item) => ({
        // These are required.
        matchString: item.matchString,
        action: item.action,
        // Set default parameters on options if they are not set.
        ignoreCase: item.ignoreCase ?? true,
        removeMatchingText: item.removeMatchingText ?? true,
        prefix: item.prefix ?? undefined,
        matchLength: item.matchString.length,
        maxPrefixLookback: item.maxPrefixLookback ?? 1, // Only look at the immediately preceding character unless a larger match is requested.
      }));
    }

    this.longestItem = Math.max(
      ...this.options.items.map((i) => i.matchLength)
    );

    quill.on("text-change", this.textChanged.bind(this));
    // quill.on("selection-change", this.selectionChanged.bind(this));
  }

  //   selectionChanged: SelectionChangeHandler = (range, oldRange, source) => {};

  textChanged: TextChangeHandler = (delta, oldContents, source) => {
    // console.log(source);
    // console.log(this.quill.getText());
    // If the text change did not come from the user, then break out
    if (source !== "user") return;

    // If there is a currently selected range or the editor doesn't have focus (range is null),
    // break out of this method.
    const range = this.quill.getSelection();
    if (range && range.length !== 0) return;

    // range.index is the currently selected position.
    // Try and get our longestItem but if that's not possible, get the longest pre match we can get.
    const end = range?.index ?? Math.max(0, this.quill.getLength() - 1);
    const start = Math.max(0, end - this.longestItem);
    const candidateText = this.quill.getText(start, end - start);
    // console.log(`candidate text: ${candidateText}`);
    this.options.items.some((item) => {
      // If the target match is longer than the substring we were able to get,
      // there's no way it could fire.
      if (candidateText.length < item.matchLength) {
        return false;
      }
      // If we're here then candidateText is either the same length or longer than our test,
      // so let's get an exact length starting at the end.
      const candidateTextItemSpecific = candidateText.substring(
        candidateText.length - item.matchLength
      );

      // Do either a case-sensitive compare or a case-insensitive compare and continue if no match.
      if (
        item.ignoreCase &&
        !this.equalsIgnoringCase(candidateTextItemSpecific, item.matchString)
      ) {
        return false;
      }
      if (!item.ignoreCase && candidateTextItemSpecific !== item.matchString) {
        return false;
      }
      // If there's a prefix defined, check that it matches.
      if (item.prefix !== undefined) {
        //   0      lookback  start    end
        //   [preamble]|[prefix]|[match]|
        // We want to skip preamble and only capture prefix.
        const windowStart = Math.max(
          0,
          end - item.matchLength - item.maxPrefixLookback
        );
        const windowEnd = Math.max(0, end - item.matchLength - windowStart);
        const prefixText = this.quill.getText(windowStart, windowEnd);
        // console.log(`windowStart: ${windowStart}`);
        // console.log(`windowEnd: ${windowEnd}`);
        // console.log(`PREFIX: ${prefixText}`);
        // console.log(`candidate text: ${candidateTextItemSpecific}`);
        // console.log(`prefix regex: ${item.prefix}`);

        if (!item.prefix.test(prefixText!)) {
          return false;
        }
      }
      let currentIndex = end;
      // If we got here, either there was no prefix match requested or we matched prefix,
      // so now we just need to decide if we need to remove matching text
      // then fire the event then check if there was a replacement response to insert.
      if (item.removeMatchingText) {
        this.quill.deleteText(
          end - candidateTextItemSpecific.length,
          candidateTextItemSpecific.length,
          "api"
        );
        currentIndex -= candidateTextItemSpecific.length;
      }

      //   const result = item.action();
      //   console.log(result);
      //   if (result !== undefined) {
      //     this.quill.insertText(end, result, 'api');
      //     currentIndex += result.length;
      //   }

      //   this.quill.setSelection(
      //     {
      //       index: 3,
      //       length: 1,
      //     },
      //     'api',
      //   );
      // Only match 1 match and stop looking if we got one.
      return true;
    });
  };
}

Quill.register("modules/fire", Fire);

export default Fire;
