/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useState, useEffect, useRef} from 'react';
import {motion} from 'motion/react';

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aura-theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

  const [rigExpanded, setRigExpanded] = useState(false);
  const [thingsExpanded, setThingsExpanded] = useState(false);
  const [thingsIownExpanded, setThingsIownExpanded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const actionRef = useRef({ count: 0, lastReset: Date.now() });

  const rigContentRef = useRef<HTMLDivElement>(null);
  const thingsContentRef = useRef<HTMLDivElement>(null);
  const thingsIownContentRef = useRef<HTMLDivElement>(null);

  // 1. Anti-Inspection & Anti-Spam Logic
  useEffect(() => {
    // Block Right Click
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    // Block DevTools Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDevKey = 
        e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
        (e.ctrlKey && e.keyCode === 85); // Ctrl+U (View Source)
      
      if (isDevKey) {
        e.preventDefault();
        return false;
      }

      // Check Spam
      handleAction();
    };

    const handleAction = () => {
      const now = Date.now();
      if (now - actionRef.current.lastReset > 3000) {
        actionRef.current.count = 1;
        actionRef.current.lastReset = now;
      } else {
        actionRef.current.count++;
        if (actionRef.current.count > 15 && !isLocked) {
          setIsLocked(true);
          setTimeout(() => {
            setIsLocked(false);
            actionRef.current.count = 0;
          }, 5000);
        }
      }
    };

    // Anti-Refresh Logic
    const checkRefresh = () => {
      const refreshData = JSON.parse(localStorage.getItem('aura-refresh-check') || '{"count": 0, "time": 0}');
      const now = Date.now();
      
      if (now - refreshData.time > 60000) {
        localStorage.setItem('aura-refresh-check', JSON.stringify({ count: 1, time: now }));
      } else {
        const newCount = refreshData.count + 1;
        // Thresholds:
        // > 3 triggers the lockout popup
        // > 7 triggers the Google redirect
        if (newCount > 7) {
          window.location.href = "https://www.google.com";
          return;
        }
        if (newCount > 3) {
          setIsLocked(true);
        }
        localStorage.setItem('aura-refresh-check', JSON.stringify({ count: newCount, time: refreshData.time }));
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleAction);
    checkRefresh();

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleAction);
    };
  }, [isLocked]);

  // 2. Theme Effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aura-theme', theme);
  }, [theme]);

  // 2. Twemoji Effect
  useEffect(() => {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.twemoji) {
      // @ts-ignore
      window.twemoji.parse(document.body, {
        base: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/',
        folder: 'svg',
        ext: '.svg'
      });
    }
  }, [rigExpanded, thingsExpanded, thingsIownExpanded]);

  // 3. Inertial Momentum Scroll Engine
  useEffect(() => {
    const scrollStates = new Map<HTMLElement | Window, { current: number, target: number }>();
    let isAnimating = false;
    const ease = 0.075;

    const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

    const scrollAnimLoop = () => {
      let stillAnimating = false;

      scrollStates.forEach((state, target) => {
        state.current = lerp(state.current, state.target, ease);

        if (Math.abs(state.target - state.current) < 0.25) {
          state.current = state.target;
        } else {
          stillAnimating = true;
        }

        if (target === window) {
          window.scrollTo(0, state.current);
        } else {
          (target as HTMLElement).scrollTop = state.current;
        }
      });

      if (stillAnimating) {
        requestAnimationFrame(scrollAnimLoop);
      } else {
        isAnimating = false;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // 1. Identify scroll target
      let scrollTarget: HTMLElement | Window = window;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          if (el.scrollHeight > el.clientHeight) {
            scrollTarget = el;
            break;
          }
        }
        el = el.parentElement;
      }

      // 2. Precision check
      const isTouchpad = e.deltaY % 1 !== 0 || Math.abs(e.deltaY) < 20;
      if (isTouchpad) {
        // Just sync and let native handle it
        const currentPos = scrollTarget === window ? window.scrollY : (scrollTarget as HTMLElement).scrollTop;
        scrollStates.set(scrollTarget, { current: currentPos, target: currentPos });
        return;
      }

      e.preventDefault();

      // 3. Update target position
      let state = scrollStates.get(scrollTarget);
      if (!state) {
        const currentPos = scrollTarget === window ? window.scrollY : (scrollTarget as HTMLElement).scrollTop;
        state = { current: currentPos, target: currentPos };
      }

      const maxScroll = scrollTarget === window 
        ? document.documentElement.scrollHeight - window.innerHeight
        : (scrollTarget as HTMLElement).scrollHeight - (scrollTarget as HTMLElement).clientHeight;

      state.target = Math.max(0, Math.min(maxScroll, state.target + e.deltaY * 1.1));
      scrollStates.set(scrollTarget, state);

      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(scrollAnimLoop);
      }
    };

    const handleScrollSync = (e: Event) => {
      if (isAnimating) return;
      const target = e.target === document ? window : (e.target as HTMLElement);
      const currentPos = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      scrollStates.set(target, { current: currentPos, target: currentPos });
    };

    window.addEventListener('wheel', handleWheel, {passive: false});
    window.addEventListener('scroll', handleScrollSync, {capture: true});

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScrollSync, {capture: true});
      isAnimating = false;
    };
  }, []);

  // 4. Accordion Toggle Logic
  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleToggleRig = () => {
    setRigExpanded(!rigExpanded);
    if (!rigExpanded) {
      setTimeout(() => {
        const toggle = document.getElementById('rig-toggle');
        if (toggle) {
          window.scrollTo({
            top: toggle.offsetTop - 100,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  };

  const handleToggleThings = () => {
    setThingsExpanded(!thingsExpanded);
    if (!thingsExpanded) {
      setTimeout(() => {
        const toggle = document.getElementById('things-toggle');
        if (toggle) {
          window.scrollTo({
            top: toggle.offsetTop - 100,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  };

  const handleToggleThingsIown = () => {
    setThingsIownExpanded(!thingsIownExpanded);
    if (!thingsIownExpanded) {
      setTimeout(() => {
        const toggle = document.getElementById('things-i-own-toggle');
        if (toggle) {
          window.scrollTo({
            top: toggle.offsetTop - 100,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  };

  return (
    <>
      {/* Anti-Spam Lockout Overlay */}
      {isLocked && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6"
        >
          <div className="max-w-md flex flex-col items-center">
            <h2 className="font-outfit text-3xl font-bold text-red-500 mb-4">Suspicious Activity Detected</h2>
            <p className="text-white/70 text-lg mb-8">Your access has been temporarily suspended due to rapid interactions or excessive refreshing. Please wait a few seconds and try again.</p>
            <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        </motion.div>
      )}

      {/* Theme Switcher Button */}
      <button 
        className="theme-toggle" 
        id="theme-toggle" 
        aria-label="Toggle dark/light theme"
        onClick={toggleTheme}
      >
        <svg className="sun-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
        <svg className="moon-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <main className="main-wrapper">
        <motion.div 
          className="profile-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Avatar Banner Glow */}
          <div className="avatar-glow"></div>
          
          {/* Avatar */}
          <div className="avatar-wrapper">
            <img 
              className="avatar-image" 
              src="https://yt3.googleusercontent.com/NgKef1MCkKQZiy5_8EdP5h7RBwTMXNm6E0aUxQ9DM47EFvY8MzZi6Puq4OtxDI9S6HoWoQK0oL4=s3840-c-k-c0x00ffffff-no-rj" 
              alt="Devill Avatar" 
            />
          </div>

          {/* Name */}
          <h1 className="profile-name">Devill</h1>

          {/* Titles/Tags */}
          <div className="profile-tags">
            <span className="tag tag-purple">Vibe developer</span>
            <span className="tag tag-teal">Video editor</span>
          </div>

          {/* Bio Links / Status List */}
          <div className="bio-list">
            <div className="bio-item">
              <div className="bio-item-bg"></div>
              <span className="bio-label">I don't mind getting ping :)</span>
            </div>
            
            <div className="bio-item">
              <div className="bio-item-bg"></div>
              <span className="bio-label">might not reply tho :&gt;</span>
            </div>
            
            <div className="bio-item">
              <div className="bio-item-bg"></div>
              <span className="bio-label">I speak 🇹🇭 &amp; 🇺🇸 / 🇬🇧</span>
            </div>
            
            <div className="bio-item">
              <div className="bio-item-bg"></div>
              <span className="bio-label">I'm 🇹🇭 ♂️ (Straight)</span>
            </div>
          </div>

          {/* Custom Rig Specs Dropdown */}
          <div className="accordion-container">
            <button 
              className="accordion-trigger" 
              id="rig-toggle" 
              aria-expanded={rigExpanded}
              onClick={handleToggleRig}
            >
              <span className="trigger-label">My Rig</span>
              <span className="chevron">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            
            <div 
              className="accordion-content" 
              id="rig-content"
              style={{
                maxHeight: rigExpanded ? (rigContentRef.current?.scrollHeight ? `${Math.min(rigContentRef.current.scrollHeight, 350)}px` : '1000px') : '0px',
                overflowY: rigExpanded && (rigContentRef.current?.scrollHeight ?? 0) > 350 ? 'auto' : 'hidden'
              }}
            >
              <div className="accordion-inner" ref={rigContentRef}>
                {/* Processor */}
                <div className="spec-section">
                  <h4 className="spec-title">Processor (CPU)</h4>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">Name</span><span className="spec-val">Intel Core i5 12450HX (12th Generation "Alder Lake")</span></div>
                    <div className="spec-row"><span className="spec-label">Core Config</span><span className="spec-val">8 Cores (4 Performance Cores / 4 Efficient Cores)</span></div>
                    <div className="spec-row"><span className="spec-label">Threads</span><span className="spec-val">12 Threads</span></div>
                    <div className="spec-row"><span className="spec-label">Max TDP</span><span className="spec-val">55.0 W</span></div>
                    <div className="spec-row"><span className="spec-label">Lithography</span><span className="spec-val">Intel 7 (10 nm)</span></div>
                  </div>
                </div>

                {/* Motherboard & BIOS */}
                <div className="spec-section">
                  <h4 className="spec-title">Motherboard &amp; BIOS</h4>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">Manufacturer</span><span className="spec-val">Lenovo</span></div>
                    <div className="spec-row"><span className="spec-label">Model</span><span className="spec-val">LNVNB161216</span></div>
                    <div className="spec-row"><span className="spec-label">Bus Specs</span><span className="spec-val">PCI-Express 5.0 (32.0 GT/s)</span></div>
                    <div className="spec-row"><span className="spec-label">BIOS Version</span><span className="spec-val">Q8CN21WW (Dated: 08/21/2025)</span></div>
                  </div>
                </div>

                {/* Memory */}
                <div className="spec-section">
                  <h4 className="spec-title">Memory (RAM)</h4>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">Type &amp; Size</span><span className="spec-val">16 GB DDR5</span></div>
                    <div className="spec-row"><span className="spec-label">Channel Mode</span><span className="spec-val">2 x 32-bit (Dual-channel mode)</span></div>
                    <div className="spec-row"><span className="spec-label">Speed</span><span className="spec-val">DRAM Frequency 2394.1 MHz (Effective DDR5-4800)</span></div>
                    <div className="spec-row"><span className="spec-label">Module Info</span><span className="spec-val">16 GB stick by Ramaxel Technology (RMSB3410MD88IBF-5600). System runs it at 4800 MHz (limits of 12th-gen i5 HX).</span></div>
                    <div className="spec-row"><span className="spec-label">Timings</span><span className="spec-val">CL 40-39-39-76</span></div>
                  </div>
                </div>

                {/* Graphics */}
                <div className="spec-section">
                  <h4 className="spec-title">Graphics (GPU)</h4>
                  <p className="spec-desc">Laptop features dual graphics cards switching dynamically depending on workload.</p>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">Integrated GPU</span><span className="spec-val">Intel UHD Graphics (lighters tasks, web browsing)</span></div>
                    <div className="spec-row"><span className="spec-label">Dedicated GPU</span><span className="spec-val">NVIDIA GeForce RTX 4050 Laptop GPU</span></div>
                    <div className="spec-row"><span className="spec-label">Architecture</span><span className="spec-val">AD107 (5 nm process)</span></div>
                    <div className="spec-row"><span className="spec-label">VRAM</span><span className="spec-val">6 GB GDDR6 (Micron) on 96-bit bus</span></div>
                    <div className="spec-row"><span className="spec-label">TDP</span><span className="spec-val">55.0 W</span></div>
                    <div className="spec-row"><span className="spec-label">Cores</span><span className="spec-val">2560 CUDA Cores</span></div>
                  </div>
                </div>

                {/* Operating System */}
                <div className="spec-section">
                  <h4 className="spec-title">Operating System</h4>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">OS</span><span className="spec-val">Microsoft Windows 11 Home Single Language (64-bit)</span></div>
                    <div className="spec-row"><span className="spec-label">Version</span><span className="spec-val">25H2 (Build 26200.8457)</span></div>
                    <div className="spec-row"><span className="spec-label">DirectX</span><span className="spec-val">DirectX 12.0</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Things I Do Accordion Dropdown */}
          <div className="accordion-container" style={{marginTop: '16px'}}>
            <button 
              className="accordion-trigger" 
              id="things-toggle" 
              aria-expanded={thingsExpanded}
              onClick={handleToggleThings}
            >
              <span className="trigger-label">Things I do</span>
              <span className="chevron">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            
            <div 
              className="accordion-content" 
              id="things-content"
              style={{
                maxHeight: thingsExpanded ? (thingsContentRef.current?.scrollHeight ? `${Math.min(thingsContentRef.current.scrollHeight, 350)}px` : '1000px') : '0px',
                overflowY: thingsExpanded && (thingsContentRef.current?.scrollHeight ?? 0) > 350 ? 'auto' : 'hidden'
              }}
            >
              <div className="accordion-inner" ref={thingsContentRef}>
                {/* Development Section */}
                <div className="spec-section">
                  <h4 className="spec-title" style={{color: 'var(--accent-purple)'}}>Development</h4>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">Vibe Dev</span><span className="spec-val">Vibe developing (Full Stack)</span></div>
                    <div className="spec-row"><span className="spec-label">Focus</span><span className="spec-val">Building random coding projects, custom mods &amp; plugins, experimental web utilities &amp; cool interactive apps just for the vibe</span></div>
                  </div>
                </div>
                
                {/* Video Editing Section */}
                <div className="spec-section">
                  <h4 className="spec-title" style={{color: 'var(--accent-teal)'}}>Video Editing</h4>
                  <div className="spec-grid">
                    <div className="spec-row"><span className="spec-label">Role</span><span className="spec-val">Video editor (PR , AM)</span></div>
                    <div className="spec-row"><span className="spec-label">Softwares</span><span className="spec-val">Adobe Premiere Pro &amp; Alight Motion</span></div>
                  </div>
                  
                  {/* Logos Brand Row */}
                  <div style={{display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap'}}>
                    {/* Premiere Pro Styled Logo */}
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(153, 153, 255, 0.15)', padding: '8px 12px', borderRadius: '12px', userSelect: 'none'}}>
                      <svg width="22" height="22" viewBox="0 0 256 256">
                        <rect width="256" height="256" fill="#00005C" />
                        <rect width="248" height="248" x="4" y="4" fill="none" stroke="#9999FF" strokeWidth="10" />
                        <text x="128" y="174" fill="#9999FF" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="140" textAnchor="middle">Pr</text>
                      </svg>
                      <span style={{fontFamily: "'Outfit', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#9999FF', letterSpacing: '0.02em'}}>Premiere Pro</span>
                    </div>
                    
                    {/* Alight Motion Styled Logo */}
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(46, 242, 179, 0.15)', padding: '8px 12px', borderRadius: '12px', userSelect: 'none'}}>
                      <svg width="22" height="22" viewBox="0 0 256 256">
                        <rect width="256" height="256" fill="#002D24" />
                        <rect width="248" height="248" x="4" y="4" fill="none" stroke="#2EF2B3" strokeWidth="10" />
                        <text x="128" y="174" fill="#2EF2B3" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="130" textAnchor="middle">Am</text>
                      </svg>
                      <span style={{fontFamily: "'Outfit', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#2EF2B3', letterSpacing: '0.02em'}}>Alight Motion</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Things I Own Accordion Dropdown */}
          <div className="accordion-container" style={{marginTop: '16px'}}>
            <button 
              className="accordion-trigger" 
              id="things-i-own-toggle" 
              aria-expanded={thingsIownExpanded}
              onClick={handleToggleThingsIown}
            >
              <span className="trigger-label">Things I own</span>
              <span className="chevron">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            
            <div 
              className="accordion-content" 
              id="things-i-own-content"
              style={{
                maxHeight: thingsIownExpanded ? (thingsIownContentRef.current?.scrollHeight ? `${Math.min(thingsIownContentRef.current.scrollHeight, 350)}px` : '1000px') : '0px',
                overflowY: thingsIownExpanded && (thingsIownContentRef.current?.scrollHeight ?? 0) > 350 ? 'auto' : 'hidden'
              }}
            >
              <div className="accordion-inner" ref={thingsIownContentRef}>
                {/* Domain Section */}
                <div className="spec-section">
                  <h4 className="spec-title" style={{ color: 'var(--accent-purple)' }}>Domains</h4>
                  <div className="spec-grid">
                    <div className="spec-row">
                      <span className="spec-label">Primary</span>
                      <span className="spec-val">dvx.lol</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Secondary</span>
                      <span className="spec-val">bydevill.xyz</span>
                    </div>
                  </div>
                </div>
                
                {/* Paid Games Section */}
                <div className="spec-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <h4 className="spec-title" style={{ color: 'var(--accent-teal)' }}>Paid Games</h4>
                  <div className="spec-grid">
                    <div className="spec-row">
                      <span className="spec-label">FPS</span>
                      <span className="spec-val">DOOM (2016)</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Indie</span>
                      <span className="spec-val">G.O.P.O.T.A.</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Strategy</span>
                      <span className="spec-val">Sid Meier's Starships</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </>
  );
}
