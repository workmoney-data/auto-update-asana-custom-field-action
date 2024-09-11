"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsanaTaskGIDsFromText = void 0;
// getAsanaTaskGIDsFromText function copied from /diffy-mcdiffface/functions/updatePRBodyWithAsanaTaskURLs.ts
function getAsanaTaskGIDsFromText(text) {
    const asanaTaskGIDsInBodySorted = text
        .split('\r\n')
        .flatMap((line) => line.split('\n'))
        .flatMap((line) => {
        const match = line.match(/https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/);
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
