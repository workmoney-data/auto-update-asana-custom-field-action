"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
var Asana = require("asana");
var core = require("@actions/core");
var github = require("@actions/github");
var statusFieldGID = '257694800786854';
// getAsanaTaskGIDsFromText function copied from /diffy-mcdiffface/functions/updatePRBodyWithAsanaTaskURLs.ts
function getAsanaTaskGIDsFromText(text) {
    var asanaTaskGIDsInBodySorted = text
        .split('\r\n')
        .flatMap(function (line) { return line.split('\n'); })
        .flatMap(function (line) {
        var match = line.match(/https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/);
        if (!match) {
            return [];
        }
        var taskGID = match.groups.taskGID;
        return taskGID;
    })
        .sort(function (a, b) { return a.localeCompare(b); });
    var allUniqueAsanaGIDsSorted = Array.from(new Set(__spreadArray([], asanaTaskGIDsInBodySorted, true))).sort(function (a, b) { return a.localeCompare(b); });
    var noNewAsanaGIDs = true;
    if (allUniqueAsanaGIDsSorted.length === asanaTaskGIDsInBodySorted.length) {
        for (var i = 0; i < allUniqueAsanaGIDsSorted.length; i++) {
            var a = allUniqueAsanaGIDsSorted[i];
            var b = asanaTaskGIDsInBodySorted[i];
            if (a !== b) {
                noNewAsanaGIDs = false;
                break;
            }
        }
    }
    return allUniqueAsanaGIDsSorted;
}
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var body, asanaToken, taskIDs, _i, taskIDs_1, taskID, client, task, customFields, statusCustomField, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 6, , 7]);
                    body = (_a = github.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.body;
                    if (!body) {
                        core.info("\uD83D\uDED1 couldn't find PR body");
                        return [2 /*return*/];
                    }
                    asanaToken = core.getInput('asanaToken', {
                        required: true
                    });
                    if (!asanaToken) {
                        throw new Error("\uD83D\uDED1 couldn't find Asana access token");
                    }
                    taskIDs = getAsanaTaskGIDsFromText(body);
                    _i = 0, taskIDs_1 = taskIDs;
                    _c.label = 1;
                case 1:
                    if (!(_i < taskIDs_1.length)) return [3 /*break*/, 5];
                    taskID = taskIDs_1[_i];
                    core.info("\uD83C\uDFAC Attempting to update mentioned task ".concat(taskID));
                    client = Asana.Client.create().useAccessToken(asanaToken);
                    return [4 /*yield*/, client.tasks.findById(taskID)];
                case 2:
                    task = _c.sent();
                    core.info("Task name: \"".concat(task.name, "\""));
                    customFields = task.custom_fields;
                    core.debug("Custom fields on task: ".concat(JSON.stringify(customFields)));
                    statusCustomField = customFields.find(function (field) { return field.gid === statusFieldGID; });
                    if (!statusCustomField) {
                        core.info("\uD83D\uDED1 didn't find status field");
                        return [3 /*break*/, 4];
                    }
                    return [4 /*yield*/, client.tasks.update(taskID, {
                            custom_fields: (_b = {},
                                // GID of the "📖 In Code Review" option
                                _b[statusFieldGID] = '316679932150690',
                                _b)
                        })];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _c.sent();
                    if (error_1 instanceof Error) {
                        core.error(error_1);
                        core.setFailed(error_1.message);
                        console.error(JSON.stringify(error_1));
                    }
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
core.info('Running...');
run();
