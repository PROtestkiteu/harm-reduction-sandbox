import { MenuPolicy } from './menuPolicy';
import { LANG, LANGS, LANG_KEY, t } from '../i18n';
import { SCENARIO_CARDS, type ScenarioCard } from '../config/scenarios';
import { PARAMS, PARAM_GROUPS, defaultSettings, encodeSettings, normalize, type ParamId } from '../config/sandboxParams';
import { CONTINUE_KEY, MENU_CONTEXT_KEY, setLaunchConfiguration, type LaunchConfiguration } from '../game/launch';
import { loadSoundSettings, saveSoundSettings } from '../audio/settings';
import { scenarioIllustration } from './scenarioArt';
import { menuSave, menuLinkedSave } from '../game/menuSave';
import { RESUME_KEY } from '../game/updates';
import type { SaveData } from '../game/saveGame';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function kept(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function keep(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Optional preference. */ } }

/** Menu resolves once. The game module is not imported until the player launches. */
export function showMainMenu(): Promise<void> {
  return new Promise((resolve) => {
    const splash = document.getElementById('loading')!;
    splash.classList.add('has-menu');
    splash.removeAttribute('role');
    const menu = el('main', 'main-menu');
    const title = el('h1', 'main-menu-brand', t('Harm Reduction Project'));
    const page = el('section', 'main-menu-page');
    page.setAttribute('aria-live', 'polite');
    menu.append(title, page);
    splash.append(menu);
    let launching = false;
    let request = 0;
    let pending: AbortController | null = null;
    let selected = SCENARIO_CARDS.find((s) => s.id === kept('hrp-last-scenario')) ?? SCENARIO_CARDS[0];
    let settings = defaultSettings();
    let graphicsOverride: string | null = null;

    function button(text: string, action: () => void, primary = false): HTMLButtonElement {
      const b = el('button', primary ? 'menu-button menu-primary' : 'menu-button', text);
      b.type = 'button'; b.addEventListener('click', action);
      return b;
    }
    function screen(heading: string, kind = 'page'): void {
      menu.dataset.screen = kind;
      splash.scrollTop = 0;
      menu.scrollTop = 0;
      request++;
      pending?.abort(); pending = null;
      const headingNode = el('h2', 'menu-heading', heading);
      headingNode.tabIndex = -1;
      page.replaceChildren(headingNode);
      headingNode.focus({ preventScroll: true });
    }
    function back(): void { page.append(button(t('Back'), home)); }
    function launch(config: LaunchConfiguration, query: URLSearchParams, hash = ''): void {
      if (launching) return;
      launching = true;
      query.delete('menu'); query.delete('play');
      if (graphicsOverride) query.set('quality', graphicsOverride);
      try { sessionStorage.removeItem(RESUME_KEY); } catch { /* The chosen launch is explicit. */ }
      history.replaceState(history.state, '', `${location.pathname}${query.toString() ? `?${query}` : ''}${hash}`);
      setLaunchConfiguration(config);
      menu.remove();
      splash.classList.remove('has-menu');
      splash.setAttribute('role', 'status');
      // Commit the splash and its compositor animations before importing the scene.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }
    async function loadStored(key: string, status: HTMLElement): Promise<void> {
      const token = ++request;
      status.textContent = t('Loading game…');
      try {
        // Full field validation happens in main before restoration. Importing its parser
        // here would initialize the world layout before a scenario has been selected.
        const raw: unknown = JSON.parse((key === RESUME_KEY ? sessionStorage.getItem(key) : kept(key)) ?? 'null');
        const save = menuSave(raw);
        if (token !== request || launching) return;
        if (!save) { status.textContent = t('This saved game is unavailable. Choose another save or try again.'); return; }
        let context = '';
        if (key === CONTINUE_KEY) { try { context = kept('hrp-continue-context') ?? sessionStorage.getItem(MENU_CONTEXT_KEY) ?? ''; } catch { /* No kept context. */ } }
        const q = new URLSearchParams(key === CONTINUE_KEY ? context || location.search : kept('hrp-save-context') || location.search);
        q.set('lang', LANG);
        if (save.tutorial) q.set('scenario', 'tutorial');
        else if (q.get('scenario') === 'tutorial') q.delete('scenario');
        launch({ kind: 'resume', scenarioId: q.get('scenario'), settings: {}, custom: !!save.sandboxed, save }, q);
      } catch { if (token === request) status.textContent = t('This saved game is unavailable. Choose another save or try again.'); }
    }
    function home(): void {
      screen(t('Main menu'), 'home');
      page.append(el('p', 'menu-introduction', t('Help people stay alive without going bankrupt.')));
      const actions = el('nav', 'main-menu-actions');
      const status = el('p', 'menu-status'); status.setAttribute('role', 'status');
      let resumeKey = CONTINUE_KEY;
      try { if (menuSave(JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null'))) resumeKey = RESUME_KEY; } catch { /* Durable Continue is still available. */ }
      const resume = button(t('Continue'), () => void loadStored(resumeKey, status), true);
      try { resume.disabled = !menuSave(JSON.parse((resumeKey === RESUME_KEY ? sessionStorage.getItem(resumeKey) : kept(resumeKey)) ?? 'null')); } catch { resume.disabled = true; }
      resume.classList.toggle('menu-primary', !resume.disabled);
      actions.append(resume, button(t('New Game'), scenarios, resume.disabled), button(t('Load Game'), saves), button(t('Settings'), preferences), button(t('About'), about));
      page.append(actions, status);
    }
    function scenarios(): void {
      screen(t('New Game'), 'scenarios');
      const customize = el('details', 'menu-customize');
      customize.append(el('summary', '', t('Customize')));
      const sliders = el('div', 'menu-slider-groups');
      const locked = el('p', 'menu-note', t('Tutorial settings are fixed so each lesson remains achievable.'));
      const reset = button(t('Reset to scenario defaults'), () => { settings = defaultSettings(); policy.reset(selected.model); sync(); });
      const policy = new MenuPolicy(selected.model, sync);
      customize.append(locked, sliders, reset);
      const inputs = new Map<ParamId, { input: HTMLInputElement; output: HTMLOutputElement }>();
      for (const group of PARAM_GROUPS) {
        const details = el('details', 'menu-slider-group'); details.append(el('summary', '', group.label));
        const fields = el('div', 'menu-slider-fields');
        details.append(fields);
        for (const p of PARAMS.filter((item) => item.group === group.id)) {
          const row = el('label', 'menu-slider');
          const input = el('input', ''); input.id = `menu-param-${p.id.replace('.', '-')}`; row.htmlFor = input.id; input.type = 'range'; input.min = String(p.min); input.max = String(p.max); input.step = String(p.step); input.dataset.iconHint = p.hint; input.setAttribute('aria-description', p.hint);
          const output = el('output', ''); output.htmlFor.add(input.id);
          input.addEventListener('input', () => { settings[p.id] = normalize(p.id, Number(input.value)); sync(); });
          row.append(el('span', '', p.label), output, input); fields.append(row); inputs.set(p.id, { input, output });
        }
        sliders.append(details);
      }
      sliders.append(policy.root);
      const tiles = el('div', 'scenario-tiles'); tiles.setAttribute('role', 'group'); tiles.setAttribute('aria-label', t('Scenarios'));
      const choices = new Map<string, HTMLButtonElement>();
      SCENARIO_CARDS.forEach((scenario) => {
        const tile = button('', () => { selected = scenario; settings = defaultSettings(); policy.reset(selected.model); keep('hrp-last-scenario', selected.id); sync(); });
        tile.className = 'scenario-tile';
        const image = el('img', 'scenario-art'); image.src = scenarioIllustration(scenario.id); image.alt = ''; image.width = 320; image.height = 176; image.loading = 'eager'; image.decoding = 'async';
        tile.append(image, el('strong', '', scenario.title)); tiles.append(tile); choices.set(scenario.id, tile);
      });
      const detail = el('article', 'scenario-detail');
      const name = el('h3', ''); const description = el('p', ''); const rules = el('p', 'menu-note'); const start = button(t('Start Game'), startGame, true);
      detail.append(name, description, rules, start);
      function sync(): void {
        const isTutorial = selected.kind === 'tutorial';
        const custom = !isTutorial && (!!encodeSettings(settings) || policy.custom);
        name.textContent = `${selected.title}${custom ? ` · ${t('Custom')}` : ''}`;
        description.textContent = selected.blurb;
        rules.textContent = scenarioRules(selected, custom);
        locked.hidden = !isTutorial; sliders.hidden = isTutorial; reset.hidden = isTutorial;
        for (const [id, row] of inputs) { row.input.value = String(settings[id]); row.output.value = PARAMS.find((p) => p.id === id)!.format(settings[id]); }
        for (const [id, tile] of choices) tile.setAttribute('aria-pressed', String(id === selected.id));
      }
      function startGame(): void {
        const q = new URLSearchParams(location.search);
        for (const key of ['g', 'ctx', 'model', 'mode', 'set', 'off']) q.delete(key);
        q.set('scenario', selected.id);
        if (selected.kind !== 'tutorial') policy.apply(q);
        const encoded = selected.kind === 'tutorial' ? '' : encodeSettings(settings);
        if (encoded) q.set('set', encoded);
        const custom = selected.kind !== 'challenge' || !!encoded || policy.custom;
        launch({ kind: 'new', scenarioId: selected.id, settings: selected.kind === 'tutorial' ? {} : settings, custom }, q);
      }
      const selection = el('div', 'scenario-selection');
      selection.append(tiles, detail);
      page.append(selection, customize); back(); sync();
    }
    function saves(): void {
      screen(t('Load Game'));
      const status = el('p', 'menu-status'); status.setAttribute('role', 'status');
      const local = button(t('Load saved'), () => void loadStored('hrp-save', status)); local.disabled = !kept('hrp-save');
      const label = el('label', 'menu-link-label', t('Game link'));
      const input = el('input', 'menu-link'); input.type = 'url'; input.autocomplete = 'off';
      if (new URLSearchParams(location.search).has('g') || location.hash.startsWith('#g=')) input.value = location.href;
      label.append(input);
      const load = button(t('Open game link'), () => void openLink());
      async function openLink(): Promise<void> {
        const token = ++request;
        pending?.abort(); pending = new AbortController();
        const controller = pending;
        const signal = controller.signal;
        const timeout = window.setTimeout(() => controller.abort(), 12000);
        let recognizedLink = false;
        status.textContent = t('Loading game…');
        try {
          const url = new URL(input.value, location.href);
          if (url.origin !== location.origin || url.pathname !== location.pathname || !(url.searchParams.has('g') || url.hash.startsWith('#g='))) throw new Error('invalid');
          recognizedLink = true;
          url.searchParams.delete('menu');
          const gid = url.searchParams.get('g');
          let save: SaveData | null = null;
          if (gid) {
            if (!/^[0-9a-f]{24}$/.test(gid)) throw new Error('invalid');
            const api = new URL('api/board.php', document.baseURI); api.searchParams.set('game', gid);
            const response = await fetch(api, { cache: 'no-store', signal });
            if (!response.ok) { if (token === request) status.textContent = t('This saved game is unavailable. Choose another save or try again.'); return; }
            const body = await response.json() as { data?: unknown };
            save = typeof body.data === 'string' ? await menuLinkedSave(body.data, false) : null;
            if (token !== request || launching) return;
            if (!save) { status.textContent = t('This saved game is unavailable. Choose another save or try again.'); return; }
            if (save.tutorial) url.searchParams.set('scenario', 'tutorial');
          } else {
            save = await menuLinkedSave(url.hash.slice(3), true);
            if (token !== request || launching) return;
            if (!save) { status.textContent = t('This saved game is unavailable. Choose another save or try again.'); return; }
            if (save.tutorial) url.searchParams.set('scenario', 'tutorial');
          }
          if (token !== request || launching) return;
          if (graphicsOverride) url.searchParams.set('quality', graphicsOverride);
          if (!save) return;
          if (!save.tutorial && url.searchParams.get('scenario') === 'tutorial') url.searchParams.delete('scenario');
          launch({ kind: 'link', scenarioId: url.searchParams.get('scenario'), settings: {}, custom: !!save.sandboxed, save }, url.searchParams, url.hash);
        } catch {
          if (token === request) status.textContent = recognizedLink ? t('This saved game is unavailable. Choose another save or try again.') : t('Enter a game link from this site.');
        } finally { window.clearTimeout(timeout); }
      }
      page.append(local, label, load, status); back();
    }
    function preferences(): void {
      screen(t('Settings'));
      const language = el('label', 'menu-setting', t('Language'));
      const languages = el('select', 'menu-link');
      for (const lang of LANGS) { const option = el('option', '', lang.name); option.value = lang.id; option.selected = LANG === lang.id; languages.append(option); }
      languages.addEventListener('change', () => { keep(LANG_KEY, languages.value); const q = new URLSearchParams(location.search); q.set('lang', languages.value); q.set('menu', '1'); location.href = `${location.pathname}?${q}`; }); language.append(languages);
      const audio = loadSoundSettings();
      const sound = el('label', 'menu-setting', t('Sound')); const muted = el('input', ''); muted.type = 'checkbox'; muted.checked = !audio.muted; muted.addEventListener('change', () => { audio.muted = !muted.checked; saveSoundSettings(audio); }); sound.append(muted);
      const volume = el('label', 'menu-setting', t('Volume')); const range = el('input', ''); range.type = 'range'; range.min = '0'; range.max = '100'; range.value = String(audio.volume); range.addEventListener('input', () => { audio.volume = Number(range.value); saveSoundSettings(audio); }); volume.append(range);
      const graphics = el('label', 'menu-setting', t('Graphics')); const quality = el('select', 'menu-link');
      const modes = [{ id: 'auto', label: t('Auto') }, { id: 'low', label: t('Low') }, { id: 'medium', label: t('Medium') }, { id: 'high', label: t('High') }, { id: 'ultra', label: t('Ultra') }];
      for (const mode of modes) { const option = el('option', '', mode.label); option.value = mode.id; option.selected = (graphicsOverride ?? new URLSearchParams(location.search).get('quality') ?? kept('hrp-graphics') ?? 'auto') === mode.id; quality.append(option); }
      quality.addEventListener('change', () => { graphicsOverride = quality.value; keep('hrp-graphics', quality.value); }); graphics.append(quality);
      page.append(language, sound, volume, graphics, el('p', 'menu-note', t('Reduced motion follows your device settings.'))); back();
    }
    function about(): void {
      screen(t('About'));
      page.append(el('p', '', t('A harm reduction non-profit simulator. The challenge: more demand can easily mean less money, not more.')), el('p', 'menu-note', t('Every number is illustrative. The direction of each effect follows the research cited in the panels.')));
      back();
    }
    home();
  });
}

function scenarioRules(scenario: ScenarioCard, custom: boolean): string {
  if (scenario.kind === 'tutorial') return t('Only foot patrol at first. Services and districts unlock as you learn. Setbacks are recoverable; this run stays off the leaderboard.');
  if (scenario.kind === 'sandbox') return t('Endless play. No project collapse and no leaderboard score.');
  const s = scenario.challenge!;
  const goals = t('Goal: {nights} nights, {helped} people helped, {stars} stars, no more than {deaths} deaths.', { nights: s.nights, helped: s.helped, stars: s.stars, deaths: s.deaths });
  return `${goals} ${custom ? t('Custom settings. This run stays off the leaderboard.') : t('Hardcore rules: the project can fold.')}`;
}
