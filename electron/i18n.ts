// Lightweight i18n for the Electron main process.
// Imports the same JSON translation files used by the renderer.

import commonAr from "../cmmn/i18n/locales/ar/common.json";
import dialogsAr from "../cmmn/i18n/locales/ar/dialogs.json";
import commonEn from "../cmmn/i18n/locales/en/common.json";
import dialogsEn from "../cmmn/i18n/locales/en/dialogs.json";
import commonEs from "../cmmn/i18n/locales/es/common.json";
import dialogsEs from "../cmmn/i18n/locales/es/dialogs.json";
import commonFr from "../cmmn/i18n/locales/fr/common.json";
import dialogsFr from "../cmmn/i18n/locales/fr/dialogs.json";
import commonIt from "../cmmn/i18n/locales/it/common.json";
import dialogsIt from "../cmmn/i18n/locales/it/dialogs.json";
import commonJa from "../cmmn/i18n/locales/ja-JP/common.json";
import dialogsJa from "../cmmn/i18n/locales/ja-JP/dialogs.json";
import commonKo from "../cmmn/i18n/locales/ko-KR/common.json";
import dialogsKo from "../cmmn/i18n/locales/ko-KR/dialogs.json";
import commonRu from "../cmmn/i18n/locales/ru/common.json";
import dialogsRu from "../cmmn/i18n/locales/ru/dialogs.json";
import commonTr from "../cmmn/i18n/locales/tr/common.json";
import dialogsTr from "../cmmn/i18n/locales/tr/dialogs.json";
import commonVi from "../cmmn/i18n/locales/vi/common.json";
import dialogsVi from "../cmmn/i18n/locales/vi/dialogs.json";
import commonZh from "../cmmn/i18n/locales/zh-CN/common.json";
import dialogsZh from "../cmmn/i18n/locales/zh-CN/dialogs.json";
import commonZhTw from "../cmmn/i18n/locales/zh-TW/common.json";
import dialogsZhTw from "../cmmn/i18n/locales/zh-TW/dialogs.json";

type Locale =
	| "en"
	| "ar"
	| "es"
	| "fr"
	| "it"
	| "ja-JP"
	| "ko-KR"
	| "ru"
	| "tr"
	| "vi"
	| "zh-CN"
	| "zh-TW";
type Namespace = "common" | "dialogs";
type MessageMap = Record<string, unknown>;

const messages: Record<Locale, Record<Namespace, MessageMap>> = {
	en: { common: commonEn, dialogs: dialogsEn },
	ar: { common: commonAr, dialogs: dialogsAr },
	es: { common: commonEs, dialogs: dialogsEs },
	fr: { common: commonFr, dialogs: dialogsFr },
	it: { common: commonIt, dialogs: dialogsIt },
	"ja-JP": { common: commonJa, dialogs: dialogsJa },
	"ko-KR": { common: commonKo, dialogs: dialogsKo },
	ru: { common: commonRu, dialogs: dialogsRu },
	tr: { common: commonTr, dialogs: dialogsTr },
	vi: { common: commonVi, dialogs: dialogsVi },
	"zh-CN": { common: commonZh, dialogs: dialogsZh },
	"zh-TW": { common: commonZhTw, dialogs: dialogsZhTw },
};

let currentLocale: Locale = "en";

export function setMainLocale(locale: string) {
	if (
		locale === "en" ||
		locale === "ar" ||
		locale === "es" ||
		locale === "fr" ||
		locale === "it" ||
		locale === "ja-JP" ||
		locale === "ko-KR" ||
		locale === "ru" ||
		locale === "tr" ||
		locale === "vi" ||
		locale === "zh-CN" ||
		locale === "zh-TW"
	) {
		currentLocale = locale;
	}
}

export function getMainLocale(): Locale {
	return currentLocale;
}

function getMessageValue(obj: unknown, dotPath: string): string | undefined {
	const keys = dotPath.split(".");
	let current: unknown = obj;
	for (const key of keys) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === "string" ? current : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
	if (!vars) return str;
	return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? `{{${key}}}`));
}

export function mainT(
	namespace: Namespace,
	key: string,
	vars?: Record<string, string | number>,
): string {
	const value =
		getMessageValue(messages[currentLocale]?.[namespace], key) ??
		getMessageValue(messages.en?.[namespace], key);

	if (value == null) return `${namespace}.${key}`;
	return interpolate(value, vars);
}
