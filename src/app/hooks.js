import { useDispatch, useSelector } from 'react-redux';
import store from './store';

/** @typedef {typeof store.dispatch} AppDispatch */

/**
 * Pre-bound dispatch hook — use everywhere instead of bare useDispatch()
 * so that the store type flows through automatically if you ever add TS later.
 * @returns {AppDispatch}
 */
export const useAppDispatch = () => /** @type {AppDispatch} */ (useDispatch());

/**
 * Pre-bound selector hook — use everywhere instead of bare useSelector().
 * @type {typeof useSelector}
 */
export const useAppSelector = useSelector;
