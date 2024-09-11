// getAsanaTaskGIDsFromText function copied from /diffy-mcdiffface/functions/updatePRBodyWithAsanaTaskURLs.ts
export function getAsanaTaskGIDsFromText(text: string): string[] {
  const asanaTaskGIDsInBodySorted = text
    .split('\r\n')
    .flatMap((line) => line.split('\n'))
    .flatMap((line) => {
      const match = line.match(
        /https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/
      );
      if (!match) {
        return [];
      }
      const { taskGID } = match.groups as { taskGID: string };
      return taskGID;
    })
    .sort((a, b) => a.localeCompare(b));

  const allUniqueAsanaGIDsSorted = Array.from(new Set([...asanaTaskGIDsInBodySorted])).sort(
    (a, b) => a.localeCompare(b)
  );

  return allUniqueAsanaGIDsSorted;
}
