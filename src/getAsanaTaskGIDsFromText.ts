// getAsanaTaskGIDsFromText function copied from /diffy-mcdiffface/functions/updatePRBodyWithAsanaTaskURLs.ts
export function getAsanaTaskGIDsFromText(text: string): string[] {
  const asanaTaskGIDsInBodySorted = text
    .split('\r\n')
    .flatMap((line) => line.split('\n'))
    .flatMap((line) => {
      // Try to match the old V0 format first
      let match = line.match(
        /https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/
      );

      // If no match found, try the new V1 format
      if (!match) {
        // Match new V1 URL formats like:
        // https://app.asana.com/1/<workspace_id>/project/<project_id>/task/<task_id>
        // https://app.asana.com/1/<workspace_id>/task/<task_id>
        // https://app.asana.com/home/task/<task_id>
        // https://app.asana.com/project/<project_id>/task/<task_id>
        match = line.match(
          /https:\/\/app.asana.com(?:\/\d+\/\d+)?(?:\/(?:project|home)(?:\/\d+)?)?(?:\/task\/(?<taskGID>\d+))/
        );

        // Also try to match item format: /inbox/<domainUser_id>/item/<item_id>
        if (!match) {
          match = line.match(/https:\/\/app.asana.com\/inbox\/\d+\/item\/(?<taskGID>\d+)/);
        }
      }

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
