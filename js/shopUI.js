import { Save } from './core.js';
import { CURRENCY, MERCHANT_NAME, SHOP_ITEMS, buyError, itemById, itemCount } from './shop.js';
import { realmOfChapter } from './realms.js';
import { icon } from './icons.js';
import { Sfx } from './audio.js';

const $ = id => document.getElementById(id);

const GREETINGS = {
    montanha: 'Frio, hein? Esquente as mãos e veja o que eu trouxe.',
    inferno: 'Até aqui embaixo tem freguês. Não toque na lanterna, ela morde.',
    ceu: 'Nunca vendi tão alto. As nuvens pagam mal, mas você parece honesto.'
};

// Loja do mascate: abre por cima da fase pausada quando o jogador aperta ↑ perto dele.
export function createShop(ctx) {
    const ui = { line: '', focus: null };

    function state(d, item) {
        const count = itemCount(d, item.id);
        const error = buyError(d, item.id);
        if (item.kind === 'key' && count) return { label: 'Comprado', cls: 'owned', error };
        if (item.kind === 'stack' && count >= item.max) return { label: `Cheio ${count}/${item.max}`, cls: 'owned', error };
        if (error) return { label: error.replace(/\.$/, ''), cls: 'blocked', error };
        return { label: 'Comprar', cls: 'ready', error: null };
    }

    function card(d, item) {
        const s = state(d, item);
        const count = itemCount(d, item.id);
        const stack = item.kind === 'stack' ? `<em class="shop-count">${count}/${item.max}</em>` : '';
        return `<button class="shop-card ${s.cls}" data-act="shop-buy" data-arg="${item.id}" ${s.cls !== 'ready' ? 'aria-disabled="true"' : ''}>
            <span class="shop-icon">${icon(item.icon)}${stack}</span>
            <span class="shop-text"><b>${item.name}</b><small>${item.desc}</small></span>
            <span class="shop-price"><span class="shop-cost">${s.cls === 'owned' && item.kind === 'key' ? icon('check') : `${icon(CURRENCY.icon)} ${item.price}`}</span><i>${s.label}</i></span>
        </button>`;
    }

    function render() {
        const d = Save.data;
        if (!d) return;
        const realm = realmOfChapter(ctx.game.level.chapter);
        $('shop').dataset.realm = realm;
        $('shop-name').textContent = MERCHANT_NAME;
        $('shop-kicker').textContent = `Loja · ${ctx.game.level.name}`;
        $('shop-wallet').innerHTML = `<span title="${CURRENCY.name}">${icon(CURRENCY.icon)} <b id="shop-shards">${d.shards}</b> ${CURRENCY.short}</span>`;
        $('shop-line').textContent = `“${ui.line || GREETINGS[realm] || GREETINGS.montanha}”`;
        $('shop-grid').innerHTML = SHOP_ITEMS.map(item => card(d, item)).join('');
        $('shop-hint').innerHTML = `Ganhe cacos derrotando inimigos, pegando morangos, lendo registros e vencendo chefes · <kbd>Esc</kbd> volta ao jogo`;
    }

    function refocus(id) {
        const el = id && document.querySelector(`#shop-grid [data-arg=${id}]`);
        (el || document.querySelector('#shop-grid button') || document.querySelector('#shop button')).focus({ preventScroll: true });
    }

    const actions = {
        'shop-buy'(btn) {
            const id = btn.dataset.arg;
            const item = itemById(id);
            const error = Save.buy(id);
            if (error) {
                Sfx.denied();
                ui.line = error === 'Cacos insuficientes.' ? 'Sem cacos, sem negócio. Volte quando a bolsa pesar mais.' : error;
            } else {
                Sfx.equip();
                ui.line = item.pitch;
                ctx.toast(item.icon, 'Comprado', item.name);
            }
            render();
            refocus(id);
        }
    };

    return {
        open() {
            ui.line = '';
            render();
            ctx.show('shop');
            refocus(null);
        },
        render,
        actions
    };
}
