import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');

function setKeyPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

const translations = {
  en: [
    ['models.searchResult', '{{count}} results for "{{query}}"'],
    ['models.searchResult_one', '{{count}} result for "{{query}}"'],
    ['models.searchResult_other', '{{count}} results for "{{query}}"'],
    ['models.bulkDeleteWarning', 'You are about to permanently delete {{count}} {{modelName}} records.'],
    ['models.bulkDeleteWarning_one', 'You are about to permanently delete {{count}} {{modelName}} record.'],
    ['models.bulkDeleteWarning_other', 'You are about to permanently delete {{count}} {{modelName}} records.'],
    ['users.userCount', '{{count}} users'],
    ['users.userCount_one', '{{count}} user'],
    ['users.userCount_other', '{{count}} users'],
  ],
  de: [
    ['models.searchResult', '{{count}} Ergebnisse f\u00fcr "{{query}}"'],
    ['models.searchResult_one', '{{count}} Ergebnis f\u00fcr "{{query}}"'],
    ['models.searchResult_other', '{{count}} Ergebnisse f\u00fcr "{{query}}"'],
    ['models.bulkDeleteWarning', 'Sie sind dabei, {{count}} {{modelName}}-Datens\u00e4tze dauerhaft zu l\u00f6schen.'],
    ['models.bulkDeleteWarning_one', 'Sie sind dabei, {{count}} {{modelName}}-Datensatz dauerhaft zu l\u00f6schen.'],
    ['models.bulkDeleteWarning_other', 'Sie sind dabei, {{count}} {{modelName}}-Datens\u00e4tze dauerhaft zu l\u00f6schen.'],
    ['users.userCount', '{{count}} Benutzer'],
    ['users.userCount_one', '{{count}} Benutzer'],
    ['users.userCount_other', '{{count}} Benutzer'],
  ],
  es: [
    ['models.searchResult', '{{count}} resultados para "{{query}}"'],
    ['models.searchResult_one', '{{count}} resultado para "{{query}}"'],
    ['models.searchResult_other', '{{count}} resultados para "{{query}}"'],
    ['models.bulkDeleteWarning', 'Est\u00e1 a punto de eliminar permanentemente {{count}} registros de {{modelName}}.'],
    ['models.bulkDeleteWarning_one', 'Est\u00e1 a punto de eliminar permanentemente {{count}} registro de {{modelName}}.'],
    ['models.bulkDeleteWarning_other', 'Est\u00e1 a punto de eliminar permanentemente {{count}} registros de {{modelName}}.'],
    ['users.userCount', '{{count}} usuarios'],
    ['users.userCount_one', '{{count}} usuario'],
    ['users.userCount_other', '{{count}} usuarios'],
  ],
  fr: [
    ['models.searchResult', '{{count}} r\u00e9sultats pour "{{query}}"'],
    ['models.searchResult_one', '{{count}} r\u00e9sultat pour "{{query}}"'],
    ['models.searchResult_other', '{{count}} r\u00e9sultats pour "{{query}}"'],
    ['models.bulkDeleteWarning', 'Vous \u00eates sur le point de supprimer d\u00e9finitivement {{count}} enregistrements {{modelName}}.'],
    ['models.bulkDeleteWarning_one', 'Vous \u00eates sur le point de supprimer d\u00e9finitivement {{count}} enregistrement {{modelName}}.'],
    ['models.bulkDeleteWarning_other', 'Vous \u00eates sur le point de supprimer d\u00e9finitivement {{count}} enregistrements {{modelName}}.'],
    ['users.userCount', '{{count}} utilisateurs'],
    ['users.userCount_one', '{{count}} utilisateur'],
    ['users.userCount_other', '{{count}} utilisateurs'],
  ],
  it: [
    ['models.searchResult', '{{count}} risultati per "{{query}}"'],
    ['models.searchResult_one', '{{count}} risultato per "{{query}}"'],
    ['models.searchResult_other', '{{count}} risultati per "{{query}}"'],
    ['models.bulkDeleteWarning', 'Stai per eliminare definitivamente {{count}} record di {{modelName}}.'],
    ['models.bulkDeleteWarning_one', 'Stai per eliminare definitivamente {{count}} record di {{modelName}}.'],
    ['models.bulkDeleteWarning_other', 'Stai per eliminare definitivamente {{count}} record di {{modelName}}.'],
    ['users.userCount', '{{count}} utenti'],
    ['users.userCount_one', '{{count}} utente'],
    ['users.userCount_other', '{{count}} utenti'],
  ],
  nl: [
    ['models.searchResult', '{{count}} resultaten voor "{{query}}"'],
    ['models.searchResult_one', '{{count}} resultaat voor "{{query}}"'],
    ['models.searchResult_other', '{{count}} resultaten voor "{{query}}"'],
    ['models.bulkDeleteWarning', 'U staat op het punt {{count}} {{modelName}}-records permanent te verwijderen.'],
    ['models.bulkDeleteWarning_one', 'U staat op het punt {{count}} {{modelName}}-record permanent te verwijderen.'],
    ['models.bulkDeleteWarning_other', 'U staat op het punt {{count}} {{modelName}}-records permanent te verwijderen.'],
    ['users.userCount', '{{count}} gebruikers'],
    ['users.userCount_one', '{{count}} gebruiker'],
    ['users.userCount_other', '{{count}} gebruikers'],
  ],
  pl: [
    ['models.searchResult', '{{count}} wynik\u00f3w dla "{{query}}"'],
    ['models.searchResult_one', '{{count}} wynik dla "{{query}}"'],
    ['models.searchResult_other', '{{count}} wynik\u00f3w dla "{{query}}"'],
    ['models.bulkDeleteWarning', 'Zamierzasz trwale usun\u0105\u0107 {{count}} rekord\u00f3w {{modelName}}.'],
    ['models.bulkDeleteWarning_one', 'Zamierzasz trwale usun\u0105\u0107 {{count}} rekord {{modelName}}.'],
    ['models.bulkDeleteWarning_other', 'Zamierzasz trwale usun\u0105\u0107 {{count}} rekord\u00f3w {{modelName}}.'],
    ['users.userCount', '{{count}} u\u017cytkownik\u00f3w'],
    ['users.userCount_one', '{{count}} u\u017cytkownik'],
    ['users.userCount_other', '{{count}} u\u017cytkownik\u00f3w'],
  ],
  pt: [
    ['models.searchResult', '{{count}} resultados para "{{query}}"'],
    ['models.searchResult_one', '{{count}} resultado para "{{query}}"'],
    ['models.searchResult_other', '{{count}} resultados para "{{query}}"'],
    ['models.bulkDeleteWarning', 'Voc\u00ea est\u00e1 prestes a excluir permanentemente {{count}} registros de {{modelName}}.'],
    ['models.bulkDeleteWarning_one', 'Voc\u00ea est\u00e1 prestes a excluir permanentemente {{count}} registro de {{modelName}}.'],
    ['models.bulkDeleteWarning_other', 'Voc\u00ea est\u00e1 prestes a excluir permanentemente {{count}} registros de {{modelName}}.'],
    ['users.userCount', '{{count}} usu\u00e1rios'],
    ['users.userCount_one', '{{count}} usu\u00e1rio'],
    ['users.userCount_other', '{{count}} usu\u00e1rios'],
  ],
  ru: [
    ['models.searchResult', '{{count}} \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432 \u0434\u043b\u044f "{{query}}"'],
    ['models.searchResult_one', '{{count}} \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0434\u043b\u044f "{{query}}"'],
    ['models.searchResult_other', '{{count}} \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432 \u0434\u043b\u044f "{{query}}"'],
    ['models.bulkDeleteWarning', '\u0412\u044b \u0441\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0435\u0441\u044c \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0443\u0434\u0430\u043b\u0438\u0442\u044c {{count}} \u0437\u0430\u043f\u0438\u0441\u0435\u0439 {{modelName}}.'],
    ['models.bulkDeleteWarning_one', '\u0412\u044b \u0441\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0435\u0441\u044c \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0443\u0434\u0430\u043b\u0438\u0442\u044c {{count}} \u0437\u0430\u043f\u0438\u0441\u044c {{modelName}}.'],
    ['models.bulkDeleteWarning_other', '\u0412\u044b \u0441\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0435\u0441\u044c \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0443\u0434\u0430\u043b\u0438\u0442\u044c {{count}} \u0437\u0430\u043f\u0438\u0441\u0435\u0439 {{modelName}}.'],
    ['users.userCount', '{{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439'],
    ['users.userCount_one', '{{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'],
    ['users.userCount_other', '{{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439'],
  ],
  sv: [
    ['models.searchResult', '{{count}} resultat f\u00f6r "{{query}}"'],
    ['models.searchResult_one', '{{count}} resultat f\u00f6r "{{query}}"'],
    ['models.searchResult_other', '{{count}} resultat f\u00f6r "{{query}}"'],
    ['models.bulkDeleteWarning', 'Du h\u00e5ller p\u00e5 att permanent radera {{count}} {{modelName}}-poster.'],
    ['models.bulkDeleteWarning_one', 'Du h\u00e5ller p\u00e5 att permanent radera {{count}} {{modelName}}-post.'],
    ['models.bulkDeleteWarning_other', 'Du h\u00e5ller p\u00e5 att permanent radera {{count}} {{modelName}}-poster.'],
    ['users.userCount', '{{count}} anv\u00e4ndare'],
    ['users.userCount_one', '{{count}} anv\u00e4ndare'],
    ['users.userCount_other', '{{count}} anv\u00e4ndare'],
  ],
};

for (const locale of Object.keys(translations)) {
  const adminPath = path.join(LOCALES_DIR, locale, 'admin.json');
  const data = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  for (const [key, value] of translations[locale]) {
    setKeyPath(data, key, value);
  }
  fs.writeFileSync(adminPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`${locale}/admin.json: added 3 keys (+ plural variants)`);
}
