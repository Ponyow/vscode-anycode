/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Parser from '../tree-sitter/tree-sitter';
import c_sharp from './queries/c_sharp';
import c from './queries/c';
import cpp from './queries/cpp';
import go from './queries/go';
import java from './queries/java';
import php from './queries/php';
import python from './queries/python';
import rust from './queries/rust';
import typescript from './queries/typescript';
import { FeatureConfig, LanguageConfiguration } from './common';

export type QueryModule = {
	outline?: string;
	comments?: string;
	folding?: string;
	locals?: string;
	identifiers?: string;
	references?: string;
};

export type QueryType = keyof QueryModule;


const _queryModules = new Map<string, QueryModule>([
	['csharp', c_sharp],
	['c', c],
	['cpp', cpp],
	['go', go],
	['java', java],
	['php', php],
	['python', python],
	['rust', rust],
	['typescript', typescript],
]);

export default abstract class Languages {

	private static _config = new Map<string, FeatureConfig>();
	private static _languages = new Map<string, Parser.Language>();

	static async init(langInfo: LanguageConfiguration) {
		for (const [entry, config] of langInfo) {
			const lang = await Parser.Language.load(entry.wasmUri);
			this._languages.set(entry.languageId, lang);
			this._config.set(entry.languageId, config);
		}
	}

	static getLanguage(languageId: string): Parser.Language | undefined {
		let result = this._languages.get(languageId);
		if (!result) {
			console.warn(`UNKNOWN languages: '${languageId}'`);
			return undefined;
		}
		return result;
	}

	static allAsSelector(): string[] {
		return [...this._languages.keys()];
	}

	private static readonly _queryInstances = new Map<string, Parser.Query>();

	static getQuery(languageId: string, type: QueryType, strict = false): Parser.Query {

		const module = _queryModules.get(languageId);
		if (!module) {
			// unknown language or invalid query (deleted after failed parse attempt)
			return this.getLanguage(languageId)!.query('');
		}

		const source = module[type] ?? '';
		const key = `${languageId}/${type}`;

		let query = this._queryInstances.get(key);
		if (!query) {
			try {
				query = this.getLanguage(languageId)!.query(source);
			} catch (e) {
				query = this.getLanguage(languageId)!.query('');
				console.error(languageId, e);
				if (strict) {
					throw e;
				}
			}
			this._queryInstances.set(key, query);
		}
		return query;
	}

	static getSupportedLanguages(feature: keyof FeatureConfig, types: QueryType[]): string[] {
		const result: string[] = [];
		for (let languageId of this._languages.keys()) { // USE actually supported languages
			const module = _queryModules.get(languageId);
			if (!module) {
				console.warn(`${languageId} NOT supported by queries`);
				continue;
			}
			for (let type of types) {
				if (module[type] && this._config.get(languageId)?.[feature]) {
					result.push(languageId);
					break;
				}
			}
		}
		return result;
	}
}
