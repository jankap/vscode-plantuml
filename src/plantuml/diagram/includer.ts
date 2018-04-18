import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { config } from '../config';
import { context } from '../common';
import { Diagram } from './diagram';

type FolderIncludes = {
    [key: string]: includeCache;
}

interface includeCache {
    // folderPath:string;
    includes: string;
    settings: string;
}

class Includer {
    private _calculated: FolderIncludes = {};

    addIncludes(diagram: Diagram): string {
        let folder = vscode.workspace.getWorkspaceFolder(diagram.parentUri);
        let folderPath = folder ? folder.uri.fsPath : "";
        let folderUri = folder ? folder.uri : undefined;
        let cache = this._calculated[folderPath];
        if (!cache || cache.settings != config.includes(folderUri).sort().toString()) {
            cache = this._calcIncludes(folderUri);
            this._calculated[folderPath] = cache;
        }
        if (!cache.includes) return diagram.content;
        return diagram.content.replace(/\n\s*'\s*autoinclude\s*\n/i, `${cache.includes}\n`);
    }
    private _calcIncludes(uri: vscode.Uri): includeCache {
        let includes = "";
        let confs = config.includes(uri);
        let paths = [];
        for (let c of confs) {
            if (!c) continue;
            if (!path.isAbsolute(c)) {
                let ws = uri ? this._findWorkspace(uri.fsPath, c) : [];
                let inte = this._findIntegrated(c);
                paths.push(...ws, ...inte);
                continue;
            }
            if (fs.existsSync(c)) paths.push(c);
        }
        return <includeCache>{
            settings: confs.sort().toString(),
            includes: paths.reduce((pre, cur) => `${pre}\n!include ${cur}`, ""),
        };
    }
    private _findWorkspace(folder: string, conf: string): string[] {
        if (!folder) return [];
        conf = path.join(folder, conf);
        if (fs.existsSync(conf)) {
            if (fs.statSync(conf).isDirectory()) return fs.readdirSync(conf).map(f => path.join(conf, f));
            return [conf];
        }
        return [];
    }
    private _findIntegrated(p: string): string[] {
        p = path.join(context.extensionPath, "includes", p + ".wsd");
        if (fs.existsSync(p)) return [p];
        return [];
    }
    private _canNotInclude(content: string): boolean {
        let lines = content.split("\n");
        let line1 = lines[0];
        let line2 = "";
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                line2 = lines[i];
                break;
            }
        }
        return isSalt(line1) || isSalt(line2)
            || isEgg(line2) || isEarth(line2);
        function isSalt(line: string): boolean {
            return /^\s*salt\s*$/i.test(line) || /^\s*@startsalt/i.test(line);
        }
        function isEgg(line: string): boolean {
            return lines.length == 3 && /^\s*(license|version|sudoku|listfonts|listopeniconic)/i.test(line);
        }
        function isEarth(line: string): boolean {
            return /^\s*xearth\(\d+,\d+\)\s*$/i.test(line);
        }
    }
}
export const includer = new Includer();