"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsanaTaskGIDsFromText = void 0;
// getAsanaTaskGIDsFromText function copied from /diffy-mcdiffface/functions/updatePRBodyWithAsanaTaskURLs.ts
function getAsanaTaskGIDsFromText(text) {
    const asanaTaskGIDsInBodySorted = text
        .split('\r\n')
        .flatMap((line) => line.split('\n'))
        .flatMap((line) => {
        // Match task URLs with /task/{id} format first (most reliable)
        let match = line.match(/https:\/\/app.asana.com(?:.*?)\/(?:task|item)\/(?<taskGID>\d+)/);
        // If no match, try the old V0 format as fallback
        if (!match) {
            match = line.match(/https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/);
            // For V0 format we need to make sure we're not matching workspace/project IDs
            // Only use this if we can't find a /task/ pattern in the URL
            if (match && line.includes('/task/')) {
                match = null; // Reset match as it's likely a workspace ID in a task URL
            }
        }
        // Also try to match item format: /inbox/<domainUser_id>/item/<item_id>
        if (!match) {
            match = line.match(/https:\/\/app.asana.com\/inbox\/\d+\/item\/(?<taskGID>\d+)/);
        }
        if (!match) {
            return [];
        }
        const { taskGID } = match.groups;
        return taskGID;
    })
        .sort((a, b) => a.localeCompare(b));
    const allUniqueAsanaGIDsSorted = Array.from(new Set([...asanaTaskGIDsInBodySorted])).sort((a, b) => a.localeCompare(b));
    return allUniqueAsanaGIDsSorted;
}
exports.getAsanaTaskGIDsFromText = getAsanaTaskGIDsFromText;
