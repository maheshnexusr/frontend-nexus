/**
 * SignInTabs — sliding-indicator tab switcher for sign-in methods.
 * Renders either PasswordLoginForm or OTPLoginForm based on active tab.
 */

import { useState } from 'react';
import PasswordLoginForm from './PasswordLoginForm';
import OTPLoginForm      from './OTPLoginForm';
import styles            from './SignInTabs.module.css';

const TABS = [
  { id: 'password', label: 'Password'           },
  { id: 'otp',      label: 'OTP / Passwordless' },
];

export default function SignInTabs() {
  const [activeTab, setActiveTab] = useState('password');

  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  return (
    <div>
      {/* Heading */}
      <div className={styles.heading}>
        <h2 className={styles.title}>Welcome back</h2>
        <p className={styles.sub}>Sign in to your SclinNexus workspace</p>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist" aria-label="Sign-in method">
        {/* Sliding background pill */}
        <div
          className={styles.indicator}
          style={{
            left:  `calc(${activeIndex} * (100% / ${TABS.length}))`,
            width: `calc(100% / ${TABS.length})`,
          }}
          aria-hidden="true"
        />

        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            className={activeTab === tab.id
              ? `${styles.tab} ${styles.tabActive}`
              : styles.tab
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels — unmount inactive to reset form state */}
      <div
        id="tabpanel-password"
        role="tabpanel"
        aria-labelledby="tab-password"
        hidden={activeTab !== 'password'}
      >
        {activeTab === 'password' && <PasswordLoginForm />}
      </div>
      <div
        id="tabpanel-otp"
        role="tabpanel"
        aria-labelledby="tab-otp"
        hidden={activeTab !== 'otp'}
      >
        {activeTab === 'otp' && <OTPLoginForm />}
      </div>
    </div>
  );
}
