/**
 * useReadOnlyView — single source of truth for "is this CRO user viewing
 * a sponsor workspace as read-only?"
 *
 * Returns:
 *   { isReadOnly, sponsor, user, studies, exit, readOnlyMessage }
 *
 * The `disabledProps` helper makes it cheap to neutralise any write button:
 *
 *   const ro = useReadOnlyView();
 *   <button {...ro.disabledProps('Add Site')}>Add Site</button>
 *
 * — when read-only, the button gets `disabled` + a `title` tooltip and the
 * onClick is swallowed; otherwise it passes through unchanged.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  exitSponsorView,
  selectIsSponsorReadOnly,
  selectSponsorViewSponsor,
  selectSponsorViewUser,
  selectSponsorViewStudies,
} from '@/features/workspace/store/sponsorViewSlice';

const READ_ONLY_TOOLTIP = 'Read-only view — sign in as the sponsor to make changes';

export function useReadOnlyView() {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const isReadOnly = useAppSelector(selectIsSponsorReadOnly);
  const sponsor    = useAppSelector(selectSponsorViewSponsor);
  const user       = useAppSelector(selectSponsorViewUser);
  const studies    = useAppSelector(selectSponsorViewStudies);

  /**
   * Drop the read-only viewer state and bounce to the CRO dashboard.
   * Does NOT touch the CRO accessToken.
   */
  const exit = useCallback(() => {
    dispatch(exitSponsorView());
    navigate('/cro/dashboard');
  }, [dispatch, navigate]);

  /**
   * Spread onto a write-control to disable it in read-only mode.
   * `label` is purely cosmetic — used for the tooltip.
   */
  const disabledProps = useCallback(
    (label) => (isReadOnly
      ? {
          disabled: true,
          title:    READ_ONLY_TOOLTIP,
          'aria-disabled': true,
          'data-readonly': true,
          'data-readonly-label': label ?? undefined,
          onClick:  (e) => { e.preventDefault(); e.stopPropagation(); },
        }
      : {}),
    [isReadOnly],
  );

  return {
    isReadOnly,
    sponsor,
    user,
    studies,
    readOnlyMessage: READ_ONLY_TOOLTIP,
    exit,
    disabledProps,
  };
}
