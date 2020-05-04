import Quill from "quill";
import { SelectionChangeHandler, TextChangeHandler } from "quill";

export interface FireItem {
  matchString: string;
  action: () => string | null; // Calls action.  TODO: support returning a Delta to build mention functionality. If string is returned, adds string to contents.
  ignoreCase?: boolean;
  removeMatchingText?: boolean; // if false, will leave matching text but will fire, if true, will delete matching text before firing.
  prefix?: RegExp; // if a matchString is found, ensures the given prefix regex matches before the string before firing.
}

interface FireInternalItem {
  matchString: string;
  action: () => string | null; // Calls action.  TODO: support returning a Delta to build mention functionality. If string is returned, adds string to contents.
  ignoreCase: boolean;
  removeMatchingText: boolean; // if false, will leave matching text but will fire, if true, will delete matching text before firing.
  prefix: RegExp; // if a matchString is found, ensures the given prefix regex matches before the string before firing.
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
        prefix: item.prefix ?? /([\s.?!)]+$)|(^$)/,
        matchLength: item.matchString.length,
      }));
    }

    this.longestItem = Math.max(
      ...this.options.items.map((i) => i.matchLength)
    );

    quill.on("text-change", this.textChanged.bind(this));
    // quill.on("selection-change", this.selectionChanged.bind(this));
  }

  selectionChanged: SelectionChangeHandler = (range, oldRange, source) => {};

  textChanged: TextChangeHandler = (delta, oldContents, source) => {
    // If the text change did not come from the user, then break out
    if (source !== "user") return;

    // Store the full preceding text so we can do the prefix regex match, but don't retrieve it until the first time it is used.
    var fullPrefixText: string | null = null;

    // If there is a currently selected range or the editor doesn't have focus (range is null), break out of this method.
    var range = this.quill.getSelection();
    if (!range || range.length !== 0) return;

    // range.index is the currently selected position. Try and get our longestItem but if that's not possible, get the longest pre match we can get.
    const end = range.index;
    const start = Math.max(0, end - this.longestItem);
    const candidateText = this.quill.getText(start, end - start);
    for (const item of this.options.items) {
      // If the target match is longer than the substring we were able to get, there's no way it could fire.
      if (candidateText.length < item.matchLength) {
        continue;
      }
      // If we're here then candidateText is either the same length or longer than our test, so let's get an exact length starting at the end.
      let candidateTextItemSpecific = candidateText.substring(
        candidateText.length - item.matchLength
      );

      // Do either a case-sensitive compare or a case-insensitive compare and continue if no match.
      if (
        item.ignoreCase &&
        !this.equalsIgnoringCase(candidateTextItemSpecific, item.matchString)
      ) {
        continue;
      } else if (candidateTextItemSpecific === item.matchString) {
        continue;
      }

      // If there's a prefix defined, check that it matches.
      if (item.prefix !== undefined) {
        // If no previous match has attempted to get full prefix text, get it now.  We're doing this to memoize the access of the text
        // so we don't get it each time a prefix regex comes up.
        if (fullPrefixText == null) {
          fullPrefixText = this.quill.getText(0, Math.max(0, start));
        }

        if (!item.prefix.test(fullPrefixText!)) {
          continue;
        }
      }
      // If we got here, either there was no prefix match requested or we matched prefix, so now we just need to decide if we need to remove matching text
      // then fire the event then check if there was a replacement response to insert.
      if (item.removeMatchingText) {
        this.quill.deleteText(
          end - candidateTextItemSpecific.length,
          end,
          "api"
        );
      }
      var result = item.action();
      if (result) {
        this.quill.insertText(
          end - candidateTextItemSpecific.length,
          result,
          "api"
        );
      }
      // Only match 1 match and stop looking if we got one.
      break;
    }
  };
}

Quill.register("modules/fire", Fire);

export default Fire;
