import { LOCALE } from '../i18n';

/** The mark the money display uses; every price shows it, so money always reads the same. */
export const COIN = '●';

/** A price or an amount of money: the coin mark and a rounded number. */
export const price = (n: number): string => `${COIN} ${Math.round(n).toLocaleString(LOCALE)}`;
