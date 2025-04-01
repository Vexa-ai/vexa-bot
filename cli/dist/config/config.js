"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.BotConfigSchema = void 0;
const zod_1 = require("zod");
const fs = __importStar(require("fs"));
exports.BotConfigSchema = zod_1.z.object({
    platform: zod_1.z.enum(["google", "zoom", "teams"]),
    meetingUrl: zod_1.z.string().url(),
    botName: zod_1.z.string(),
    token: zod_1.z.string(),
    connectionId: zod_1.z.string(),
    automaticLeave: zod_1.z.object({
        waitingRoomTimeout: zod_1.z.number().int(),
        noOneJoinedTimeout: zod_1.z.number().int(),
        everyoneLeftTimeout: zod_1.z.number().int()
    })
});
const loadConfig = (configPath) => {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return exports.BotConfigSchema.safeParse(JSON.parse(configData));
};
exports.loadConfig = loadConfig;
