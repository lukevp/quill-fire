# quill-fire

Extend Quill JS editor to fire events as soon as matching text is entered!

# Example usage:

```javascript
const fire: FireOptions = {
  items: [
    {
      action: () => {
        console.log("Found!");
        return null;
      },
      matchString: "/",
      prefix: /([\s.?!)]+$)|(^$)/,
      ignoreCase: true,
    },
    {
      action: () => {
        console.log("Found case insensitive string: MATCH");
        return null;
      },
      matchString: "MATCH",
      ignoreCase: true,
      prefix: /\s+$/,
      removeMatchingText: true,
    },
    {
      action: () => {
        console.log("Found case sensitive string: caSeTest");
        return null;
      },
      matchString: "caSeTest",
      removeMatchingText: false,
      ignoreCase: false,
    },
    {
      action: () => {
        console.log("Found exact string Bar after string FOO");
        return null;
      },
      prefix: /FOO$/,
      matchString: "Bar",
      removeMatchingText: false,
      ignoreCase: false,
    },
  ],
};
```
