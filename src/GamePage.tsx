import { type PointerEvent, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type TrafficCar = {
    id: number;
    lane: 0 | 1 | 2;
    distance: number;
    speed: number;
    color: string;
    type: 'car' | 'shield' | 'police' | 'brick' | 'cake';
    // Boss-only fields. Bosses are police-typed cars that swerve between lanes
    // for added drama. `displayLane` interpolates between integer lanes for the
    // visual swerve; collisions still test against `lane` after snap.
    isBoss?: boolean;
    displayLane?: number;
    nextSwerveAt?: number;
    swervesLeft?: number;
};

const CAR_SKINS = [
    { id: 'bumble',  label: 'Bumble Bee',    color: '#ffcf00', windshield: '#e0f2ff', cost: 0,  wrap: 'stripes_black' },
    { id: 'racer',   label: 'Race Day',       color: '#eeeeee', windshield: '#e3f2fd', cost: 5,  wrap: 'stripes_red'   },
    { id: 'checker', label: 'Checkered',      color: '#1a1a1a', windshield: '#e0f2ff', cost: 5,  wrap: 'checker'       },
    { id: 'inferno', label: 'Inferno',        color: '#b71c1c', windshield: '#fff3e0', cost: 10, wrap: 'flames'        },
    { id: 'carbon',  label: 'Carbon Ghost',   color: '#1c1c1c', windshield: '#b2ebf2', cost: 10, wrap: 'carbon'        },
    { id: 'galaxy',  label: 'Galaxy',         color: '#1a0533', windshield: '#e1bee7', cost: 15, wrap: 'galaxy'        },
    { id: 'nebula',  label: 'Neon Stream',    color: '#0a2238', windshield: '#b3e5fc', cost: 22, wrap: 'neon_stream'    },
    { id: 'comet',   label: 'Pulse Grid',     color: '#1b2a1e', windshield: '#c8e6c9', cost: 24, wrap: 'pulse_grid'     },
    { id: 'vortex',  label: 'Thunder Wave',   color: '#281b42', windshield: '#d1c4e9', cost: 28, wrap: 'thunder_wave'   },
    { id: 'quasar',  label: 'Lava Flow',      color: '#3a100b', windshield: '#ffe0b2', cost: 32, wrap: 'lava_flow'      },
    { id: 'nova',    label: 'Holo Shift',     color: '#1f1f28', windshield: '#e1bee7', cost: 36, wrap: 'holo_shift'     },
    { id: 'void',    label: 'Matrix Rain',    color: '#06130a', windshield: '#b2dfdb', cost: 42, wrap: 'matrix_rain'    },
    { id: 'nate',    label: 'Nate-Mobile',    color: '#7b1fa2', windshield: '#e1bee7', cost: 10, wrap: 'nate'           },
    { id: 'esben',   label: 'Esben-Mobile',   color: '#0d47a1', windshield: '#b3e5fc', cost: 15, wrap: 'esben'          },
    { id: 'jakob',   label: 'Jakob-Mobile',   color: '#1b5e20', windshield: '#c8e6c9', cost: 15, wrap: 'jakob'          },
    { id: 'emil',    label: 'Emil-Mobile',    color: '#7a4f00', windshield: '#fff8e1', cost: 20, wrap: 'emil'           },
    { id: 'kasper',  label: 'Kasper-Mobile',  color: '#0a0a0a', windshield: '#cfd8dc', cost: 25, wrap: 'kasper'         },
] as const;
// IDs that belong to the "Mobiles" shop tab — collected character-themed wraps.
const MOBILE_SKIN_IDS = new Set(['nate', 'esben', 'jakob', 'emil', 'kasper']);
type CarSkinId = (typeof CAR_SKINS)[number]['id'];
type VehicleType = 'car' | 'motorcycle';

const MOTORCYCLE_SKINS = [
    { id: 'street',  label: 'Street Bolt',    color: '#f4f4f4', windshield: '#e3f2fd', cost: 0,  wrap: 'moto_stream'     },
    { id: 'pulse',   label: 'Pulse Rider',    color: '#102a43', windshield: '#bbdefb', cost: 14, wrap: 'moto_pulse'      },
    { id: 'ember',   label: 'Ember Rocket',   color: '#4a0f0f', windshield: '#ffe0b2', cost: 18, wrap: 'moto_ember'      },
    { id: 'ion',     label: 'Ion Dash',       color: '#0b2d2a', windshield: '#b2ebf2', cost: 22, wrap: 'moto_ion'        },
    { id: 'orbit',   label: 'Orbit Flux',     color: '#1b1235', windshield: '#d1c4e9', cost: 30, wrap: 'moto_galaxy_orbit' },
    { id: 'warp',    label: 'Warp Phantom',   color: '#09090f', windshield: '#cfd8dc', cost: 40, wrap: 'moto_galaxy_warp'  },
] as const;
type MotorcycleSkinId = (typeof MOTORCYCLE_SKINS)[number]['id'];

type ExplosionPiece = {
    x: number;
    y: number;
    width: number;
    height: number;
    velocityX: number;
    velocityY: number;
    rotation: number;
    spin: number;
    color: string;
    studs: number;
};

const TRAFFIC_COLORS = ['#d32f2f', '#1565c0', '#2e7d32', '#6a1b9a', '#ef6c00', '#455a64'];
const LEADERBOARD_STORAGE_KEY = 'am404_leaderboard';
const STUDS_STORAGE_KEY = 'am404_studs';
const SELECTED_SKIN_STORAGE_KEY = 'am404_selected_skin';
const UNLOCKED_SKINS_STORAGE_KEY = 'am404_unlocked_skins';
const SELECTED_VEHICLE_STORAGE_KEY = 'am404_selected_vehicle';
const MOTORCYCLES_UNLOCKED_STORAGE_KEY = 'am404_motorcycles_unlocked';
// Easter egg: hidden Mobiles tab unlock + the streak counter that gates it.
// Names intentionally generic so they don't leak the trigger via devtools.
const MOBILES_UNLOCKED_STORAGE_KEY = 'am404_mu';
const POLICE_FULL_HEALTH_DEATHS_STORAGE_KEY = 'am404_pfd';
const SELECTED_MOTORCYCLE_SKIN_STORAGE_KEY = 'am404_selected_motorcycle_skin';
const UNLOCKED_MOTORCYCLE_SKINS_STORAGE_KEY = 'am404_unlocked_motorcycle_skins';
const ACHIEVEMENTS_STORAGE_KEY = 'am404_achievements';
const STATS_STORAGE_KEY = 'am404_stats';

const ACHIEVEMENTS = [
    { id: 'score_1k',      label: '1,000 Points',     desc: 'Reach a score of 1,000',                 stat: 'bestScore',        target: 1000,  emoji: '🏁' },
    { id: 'score_5k',      label: '5,000 Points',     desc: 'Reach a score of 5,000',                 stat: 'bestScore',        target: 5000,  emoji: '⚡' },
    { id: 'score_10k',     label: '10,000 Points',    desc: 'Reach a score of 10,000',                stat: 'bestScore',        target: 10000, emoji: '🔥' },
    { id: 'score_25k',     label: '25,000 Points',    desc: 'Reach a score of 25,000',                stat: 'bestScore',        target: 25000, emoji: '💎' },
    { id: 'score_50k',     label: '50,000 Points',    desc: 'Reach a score of 50,000',                stat: 'bestScore',        target: 50000, emoji: '👑' },
    { id: 'overtake_50',   label: 'Overtaker',        desc: 'Overtake 50 cars in total',              stat: 'totalOvertakes',   target: 50,    emoji: '🚗' },
    { id: 'overtake_200',  label: 'Highway Star',     desc: 'Overtake 200 cars in total',             stat: 'totalOvertakes',   target: 200,   emoji: '⭐' },
    { id: 'overtake_500',  label: 'Speed Demon',      desc: 'Overtake 500 cars in total',             stat: 'totalOvertakes',   target: 500,   emoji: '👹' },
    { id: 'overtake_1000', label: 'LEGO Legend',      desc: 'Overtake 1,000 cars in total',           stat: 'totalOvertakes',   target: 1000,  emoji: '🏆' },
    { id: 'shield_1',      label: 'Shielded!',        desc: 'Destroy a car using your shield',        stat: 'shieldKills',      target: 1,     emoji: '🛡️' },
    { id: 'shield_10',     label: 'Shield Warrior',   desc: 'Destroy 10 cars using your shield',      stat: 'shieldKills',      target: 10,    emoji: '⚔️' },
    { id: 'shield_30',     label: 'Unstoppable',      desc: 'Destroy 30 cars using your shield',      stat: 'shieldKills',      target: 30,    emoji: '💥' },
    { id: 'bricks_1',      label: 'First Brick',      desc: 'Collect your first LEGO brick',          stat: 'bricksCollected',  target: 1,     emoji: '🧱' },
    { id: 'bricks_10',     label: 'Builder',          desc: 'Collect 10 LEGO bricks',                 stat: 'bricksCollected',  target: 10,    emoji: '🏗️' },
    { id: 'bricks_30',     label: 'Master Builder',   desc: 'Collect 30 LEGO bricks',                 stat: 'bricksCollected',  target: 30,    emoji: '🏠' },
    { id: 'police_shield', label: 'Above the Law',    desc: 'Destroy a police car with your shield',  stat: 'policeKills',      target: 1,     emoji: '👮' },
    { id: 'police_5',      label: 'Serial Outlaw',    desc: 'Destroy 5 police cars with your shield', stat: 'policeKills',      target: 5,     emoji: '🚔' },
    { id: 'studs_10',      label: 'Stud Saver',       desc: 'Earn 10 studs in total',                 stat: 'totalStudsEarned', target: 10,    emoji: '⬡' },
    { id: 'studs_50',      label: 'Stud Rich',        desc: 'Earn 50 studs in total',                 stat: 'totalStudsEarned', target: 50,    emoji: '💰' },
    { id: 'buy_skin',      label: 'Fashion Driver',   desc: 'Buy your first wrap',                    stat: 'skinsOwned',       target: 2,     emoji: '🎨' },
    { id: 'all_skins',     label: 'Full Collection',  desc: 'Unlock all car and bike wraps',          stat: 'skinsOwned',       target: 23,    emoji: '🌈' },
    { id: 'max_speed',     label: 'Full Throttle',    desc: 'Reach max difficulty (tier 8)',           stat: 'maxTierReached',   target: 8,     emoji: '🏎️' },
    { id: 'streak_10',     label: 'On a Roll',        desc: 'Reach a 10-overtake streak',             stat: 'highestStreak',    target: 10,    emoji: '🔥' },
    { id: 'streak_50',     label: 'Untouchable',      desc: 'Reach a 50-overtake streak',             stat: 'highestStreak',    target: 50,    emoji: '🚀' },
] as const;
type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];

type GameStats = {
    bestScore: number; totalOvertakes: number; shieldKills: number; policeKills: number;
    bricksCollected: number; totalStudsEarned: number; skinsOwned: number; cleanRuns: number; maxTierReached: number;
    gamesPlayed: number; totalScore: number; totalPlayMs: number; deaths: number; highestStreak: number;
};

type ConfettiPiece = { x: number; y: number; vx: number; vy: number; color: string; w: number; h: number; rotation: number; spin: number; startTime: number; };
const getShieldSpawnInterval = (score: number) => {
    if (score >= 20000) {
        return 30 + Math.floor(Math.random() * 21); // 30-50
    }
    if (score >= 10000) {
        return 25 + Math.floor(Math.random() * 6); // 25-30
    }
    return 15 + Math.floor(Math.random() * 11); // 15-25
};

// Cake spawns somewhere in the 75-100 car window so the heal pickup feels surprising.
const getCakeSpawnInterval = () => 75 + Math.floor(Math.random() * 26);

export default function GamePage() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const lastSpawnTimeRef = useRef<number>(0);
    const nextSpawnDelayRef = useRef<number>(900);
    const nextCarIdRef = useRef<number>(1);
    const spawnCountRef = useRef<number>(0);
    const nextShieldSpawnAtRef = useRef<number>(getShieldSpawnInterval(0));
    const nextCakeSpawnAtRef = useRef<number>(getCakeSpawnInterval());
    const nextBossScoreThresholdRef = useRef<number>(3000);
    const bossActiveRef = useRef<boolean>(false);
    const worldDistanceRef = useRef<number>(0);
    const roadScrollRef = useRef<number>(0);
    const laneIndexRef = useRef<0 | 1 | 2>(1);
    const displayedLaneRef = useRef<number>(1);
    const playerSpeedRef = useRef<number>(540);
    const scoreAccumulatorRef = useRef<number>(0);
    const scoreRef = useRef<number>(0);
    const bestScoreRef = useRef<number>(0);
    const isGameOverRef = useRef<boolean>(false);
    const trafficRef = useRef<TrafficCar[]>([]);
    const recentSpawnLanesRef = useRef<Array<0 | 1 | 2>>([]);
    const crashTimeRef = useRef<number | null>(null);
    const crashPiecesRef = useRef<ExplosionPiece[]>([]);
    const crashCenterRef = useRef<{ x: number; y: number } | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const musicTimerRef = useRef<number | null>(null);
    const musicGainRef = useRef<GainNode | null>(null);
    const musicStepRef = useRef<number>(0);
    const rainSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const rainGainRef = useRef<GainNode | null>(null);
    const isFirstLoadRef = useRef<boolean>(true);
    const comboKeysHeldRef = useRef<{ KeyC: boolean; KeyH: boolean; KeyR: boolean }>({ KeyC: false, KeyH: false, KeyR: false });
    const comboAwardedRef = useRef<boolean>(false);
    const developerTapComboRef = useRef<{ KeyF: boolean; KeyR: boolean; KeyE: boolean }>({ KeyF: false, KeyR: false, KeyE: false });
    const developerModeRef = useRef<boolean>(false);
    const leaderboardRef = useRef<number[]>([]);
    const shieldUntilRef = useRef<number>(0);
    const shieldWasActiveLastFrameRef = useRef<boolean>(false);
    const playerLivesRef = useRef<number>(3);
    const playerDamageRef = useRef<number>(0);
    const skidMarksRef = useRef<Array<{ x: number; y: number; distance: number; width: number; alpha: number; age: number }>>([]);
    const weatherTypeRef = useRef<'clear' | 'rain' | 'fog'>('clear');
    const lastWeatherScoreRef = useRef<number>(0);
    const weatherHistoryRef = useRef<Array<'clear' | 'rain' | 'fog'>>([]);
    const lightingIntensityRef = useRef<number>(1);

    const studsRef = useRef<number>(0);
    const selectedVehicleRef = useRef<VehicleType>('car');
    const selectedSkinRef = useRef<CarSkinId>('bumble');
    const unlockedSkinsRef = useRef<Set<CarSkinId>>(new Set(['bumble']));
    const motorcyclesUnlockedRef = useRef<boolean>(false);
    // Easter egg: tracks consecutive deaths where the killing blow came from a
    // police car and the player started the hit at full health (3 lives).
    // Reaching 2 unlocks the hidden Mobiles shop tab.
    const policeFullHealthDeathsRef = useRef<number>(0);
    const mobilesUnlockedRef = useRef<boolean>(false);
    const selectedMotorcycleSkinRef = useRef<MotorcycleSkinId>('street');
    const unlockedMotorcycleSkinsRef = useRef<Set<MotorcycleSkinId>>(new Set(['street']));
    const gameStatsRef = useRef<GameStats>({ bestScore: 0, totalOvertakes: 0, shieldKills: 0, policeKills: 0, bricksCollected: 0, totalStudsEarned: 0, skinsOwned: 1, cleanRuns: 0, maxTierReached: 0, gamesPlayed: 0, totalScore: 0, totalPlayMs: 0, deaths: 0, highestStreak: 0 });
    const unlockedAchievementsRef = useRef<Set<AchievementId>>(new Set());
    const confettiRef = useRef<ConfettiPiece[]>([]);
    const pendingAchievementToastRef = useRef<{ label: string; emoji: string; until: number } | null>(null);
    const streakRef = useRef<number>(0);
    const lastStreakMilestoneRef = useRef<number>(0);
    const pendingStreakToastRef = useRef<{ streak: number; multiplier: number; until: number } | null>(null);
    // Generic unlock toast (e.g. hidden Mobiles tab). Shares the streak toast's visual style.
    const pendingUnlockToastRef = useRef<{ title: string; subtitle: string; until: number } | null>(null);
    // Hearts flying from a picked-up cake to their slot in the HUD. Lives only get
    // incremented when the animation lands, so the player sees the heart "arrive".
    const flyingHeartsRef = useRef<Array<{ startTime: number; duration: number; startX: number; startY: number; slotIndex: number; landed: boolean }>>([]);
    // Cached gradients (recreated only on canvas resize, not per frame).
    const skyGradientRef = useRef<CanvasGradient | null>(null);
    const fogGradientRef = useRef<CanvasGradient | null>(null);
    const cachedGradientHeightRef = useRef<number>(0);

    // Single consolidated UI state. All UI-driven re-renders flow through this.
    // Refs above remain the source of truth for the per-frame game loop so we
    // never trigger a React re-render from inside requestAnimationFrame.
    type UiState = {
        isGameOver: boolean;
        isGameStarted: boolean;
        isFirstLoad: boolean;
        studs: number;
        showShop: boolean;
        showAchievements: boolean;
        shopTab: 'cars' | 'mobiles' | 'motorcycles';
        mobilesUnlocked: boolean;
        selectedVehicle: VehicleType;
        selectedSkin: CarSkinId;
        unlockedSkins: Set<CarSkinId>;
        motorcyclesUnlocked: boolean;
        selectedMotorcycleSkin: MotorcycleSkinId;
        unlockedMotorcycleSkins: Set<MotorcycleSkinId>;
        unlockedAchievements: Set<AchievementId>;
        isDeveloperMode: boolean;
    };
    const [ui, setUi] = useState<UiState>({
        isGameOver: false,
        isGameStarted: false,
        isFirstLoad: true,
        studs: 0,
        showShop: false,
        showAchievements: false,
        shopTab: 'cars',
        mobilesUnlocked: false,
        selectedVehicle: 'car',
        selectedSkin: 'bumble',
        unlockedSkins: new Set(['bumble']),
        motorcyclesUnlocked: false,
        selectedMotorcycleSkin: 'street',
        unlockedMotorcycleSkins: new Set(['street']),
        unlockedAchievements: new Set(),
        isDeveloperMode: false,
    });
    const updateUi = useCallback((patch: Partial<UiState>) => {
        setUi((prev) => ({ ...prev, ...patch }));
    }, []);
    const {
        isGameOver,
        isGameStarted,
        isFirstLoad,
        studs,
        showShop,
        showAchievements,
        shopTab,
        mobilesUnlocked,
        selectedSkin,
        unlockedSkins,
        motorcyclesUnlocked,
        selectedMotorcycleSkin,
        unlockedMotorcycleSkins,
        unlockedAchievements,
        isDeveloperMode,
    } = ui;
    const isGameStartedRef = useRef<boolean>(false);
    const isPausedRef = useRef<boolean>(false);
    const runTookDamageRef = useRef<boolean>(false);
    const runStartTimeRef = useRef<number>(0);
    const [showStats, setShowStats] = useState(false);
    const [statsSnapshot, setStatsSnapshot] = useState<GameStats | null>(null);
    const [musicOn, setMusicOn] = useState<boolean>(() => {
        try { return window.localStorage.getItem('am404_music_on') !== '0'; } catch { return true; }
    });
    const musicOnRef = useRef<boolean>(true);
    useEffect(() => { musicOnRef.current = musicOn; }, [musicOn]);
    const [sfxOn, setSfxOn] = useState<boolean>(() => {
        try { return window.localStorage.getItem('am404_sfx_on') !== '0'; } catch { return true; }
    });
    const sfxOnRef = useRef<boolean>(true);
    useEffect(() => { sfxOnRef.current = sfxOn; }, [sfxOn]);
    const toggleSfx = useCallback(() => {
        setSfxOn((prev) => {
            const next = !prev;
            try { window.localStorage.setItem('am404_sfx_on', next ? '1' : '0'); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const startBackgroundMusicRef = useRef<() => void>(() => undefined);

    const startGame = useCallback(() => {
        if (isGameStartedRef.current) {
            return;
        }
        isGameStartedRef.current = true;
        isFirstLoadRef.current = false;
        isPausedRef.current = false;
        runTookDamageRef.current = false;
        runStartTimeRef.current = performance.now();
        gameStatsRef.current.gamesPlayed += 1;
        if (musicOnRef.current) startBackgroundMusicRef.current();
        updateUi({ isGameStarted: true, isFirstLoad: false, showShop: false });
        lastFrameTimeRef.current = 0;
    }, [updateUi]);

    const resetGame = useCallback(() => {
        worldDistanceRef.current = 0;
        roadScrollRef.current = 0;
        laneIndexRef.current = 1;
        displayedLaneRef.current = 1;
        playerSpeedRef.current = 540;
        scoreAccumulatorRef.current = 0;
        scoreRef.current = 0;
        lastFrameTimeRef.current = 0;
        lastSpawnTimeRef.current = 0;
        nextSpawnDelayRef.current = 900;
        nextCarIdRef.current = 1;
        spawnCountRef.current = 0;
        nextShieldSpawnAtRef.current = getShieldSpawnInterval(0);
        nextCakeSpawnAtRef.current = getCakeSpawnInterval();
        nextBossScoreThresholdRef.current = 3000;
        bossActiveRef.current = false;
        trafficRef.current = [];
        recentSpawnLanesRef.current = [];
        crashTimeRef.current = null;
        crashPiecesRef.current = [];
        crashCenterRef.current = null;
        comboKeysHeldRef.current = { KeyC: false, KeyH: false, KeyR: false };
        comboAwardedRef.current = false;
        shieldUntilRef.current = 0;
        shieldWasActiveLastFrameRef.current = false;
        playerLivesRef.current = 3;
        playerDamageRef.current = 0;
        runTookDamageRef.current = false;
        isGameOverRef.current = false;
        isPausedRef.current = false;
        streakRef.current = 0;
        lastStreakMilestoneRef.current = 0;
        pendingStreakToastRef.current = null;
        flyingHeartsRef.current = [];
        updateUi({ isGameOver: false, showShop: false });
    }, [updateUi]);

    const moveLane = useCallback((direction: -1 | 1) => {
        if (isGameOverRef.current) {
            return;
        }

        const nextLane = laneIndexRef.current + direction;
        if (nextLane < 0 || nextLane > 2) {
            return;
        }

        laneIndexRef.current = nextLane as 0 | 1 | 2;
    }, []);

    const handleCanvasPointer = useCallback(
        (event: PointerEvent<HTMLCanvasElement>) => {
            // Only react to primary (left) mouse button. Touch/pen always report button 0.
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }
            if (!isGameStartedRef.current) {
                startGame();
                return;
            }

            if (isPausedRef.current) {
                return;
            }

            if (isGameOverRef.current) {
                resetGame();
                return;
            }

            const bounds = event.currentTarget.getBoundingClientRect();
            const pointerX = event.clientX - bounds.left;
            const ratio = pointerX / bounds.width;

            if (ratio < 0.5) {
                moveLane(-1);
                return;
            }

            moveLane(1);
        },
        [moveLane, resetGame, startGame]
    );

    const stopBackgroundMusic = useCallback(() => {
        if (musicTimerRef.current !== null) {
            window.clearInterval(musicTimerRef.current);
            musicTimerRef.current = null;
        }
        if (musicGainRef.current) {
            try {
                const ctx = audioContextRef.current;
                const g = musicGainRef.current;
                if (ctx) {
                    g.gain.cancelScheduledValues(ctx.currentTime);
                    g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
                }
            } catch { /* ignore */ }
            musicGainRef.current = null;
        }
    }, []);

    const startBackgroundMusic = useCallback(() => {
        try {
            const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) return;
            if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
            if (musicTimerRef.current !== null) return; // already playing

            const master = ctx.createGain();
            master.gain.value = 0;
            master.connect(ctx.destination);
            master.gain.setTargetAtTime(0.08, ctx.currentTime, 0.2);
            musicGainRef.current = master;

            // Simple chiptune: I-V-vi-IV in C, 16-step arpeggios + bass.
            // Frequencies (Hz) for the lead and bass per 8-step bar.
            const lead = [
                // Bar 1 — C major: C E G B  C E G E
                523.25, 659.25, 783.99, 987.77, 1046.50, 659.25, 783.99, 659.25,
                // Bar 2 — G major: G B D F#  G B D B
                392.00, 493.88, 587.33, 739.99, 783.99, 493.88, 587.33, 493.88,
                // Bar 3 — A minor: A C E G  A C E C
                440.00, 523.25, 659.25, 783.99, 880.00, 523.25, 659.25, 523.25,
                // Bar 4 — F major: F A C E  F A C A
                349.23, 440.00, 523.25, 659.25, 698.46, 440.00, 523.25, 440.00,
            ];
            const bass = [130.81, 196.00, 220.00, 174.61]; // C2 G2 A2 F2
            const stepMs = 160; // ~93 BPM with 4 16ths per beat feel

            const playStep = () => {
                const c = audioContextRef.current;
                const g = musicGainRef.current;
                if (!c || !g) return;
                const i = musicStepRef.current % lead.length;
                const bar = Math.floor(i / 8);
                const t = c.currentTime;

                // Lead (square wave)
                const leadOsc = c.createOscillator();
                const leadGain = c.createGain();
                leadOsc.type = 'square';
                leadOsc.frequency.value = lead[i];
                leadGain.gain.setValueAtTime(0, t);
                leadGain.gain.linearRampToValueAtTime(0.18, t + 0.01);
                leadGain.gain.exponentialRampToValueAtTime(0.001, t + (stepMs / 1000) * 0.9);
                leadOsc.connect(leadGain).connect(g);
                leadOsc.start(t);
                leadOsc.stop(t + (stepMs / 1000) * 0.95);

                // Bass on every other step (8th notes)
                if (i % 2 === 0) {
                    const bassOsc = c.createOscillator();
                    const bassGain = c.createGain();
                    bassOsc.type = 'triangle';
                    bassOsc.frequency.value = bass[bar];
                    bassGain.gain.setValueAtTime(0, t);
                    bassGain.gain.linearRampToValueAtTime(0.35, t + 0.01);
                    bassGain.gain.exponentialRampToValueAtTime(0.001, t + (stepMs / 1000) * 1.6);
                    bassOsc.connect(bassGain).connect(g);
                    bassOsc.start(t);
                    bassOsc.stop(t + (stepMs / 1000) * 1.7);
                }

                musicStepRef.current = (musicStepRef.current + 1) % lead.length;
            };

            playStep();
            musicTimerRef.current = window.setInterval(playStep, stepMs);
        } catch { /* ignore */ }
    }, []);

    const toggleMusic = useCallback(() => {
        setMusicOn((prev) => {
            const next = !prev;
            try { window.localStorage.setItem('am404_music_on', next ? '1' : '0'); } catch { /* ignore */ }
            return next;
        });
    }, []);

    useEffect(() => {
        if (musicOn) {
            startBackgroundMusic();
        } else {
            stopBackgroundMusic();
        }
    }, [musicOn, startBackgroundMusic, stopBackgroundMusic]);

    useEffect(() => {
        // Stop music when the component unmounts.
        return () => stopBackgroundMusic();
    }, [stopBackgroundMusic]);

    useEffect(() => {
        startBackgroundMusicRef.current = startBackgroundMusic;
    }, [startBackgroundMusic]);

    // When SFX is turned off, stop any in-flight rain loop. When turned back on
    // while it's raining, the next updateWeather tick will restart it; meanwhile
    // we just leave silence (rain only restarts at the next score tier).
    useEffect(() => {
        if (sfxOn) return;
        const source = rainSourceRef.current;
        const gain = rainGainRef.current;
        const ctx = audioContextRef.current;
        if (gain && ctx) {
            try {
                gain.gain.cancelScheduledValues(ctx.currentTime);
                gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            } catch { /* ignore */ }
        }
        if (source) {
            try { source.stop(ctx ? ctx.currentTime + 0.4 : 0); } catch { /* ignore */ }
        }
        rainSourceRef.current = null;
        rainGainRef.current = null;
    }, [sfxOn]);

    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const onChange = () => setIsFullscreen(document.fullscreenElement === canvasWrapperRef.current);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        const el = canvasWrapperRef.current;
        if (!el) {
            return;
        }
        if (document.fullscreenElement === el) {
            void document.exitFullscreen();
        } else {
            void el.requestFullscreen?.();
        }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const parent = canvas.parentElement;
        if (!parent) {
            return;
        }

        const resizeCanvas = () => {
            // Cap the backing-store resolution to keep per-frame pixel work bounded on
            // wide screens. CSS still stretches the canvas to fill its container.
            const MAX_CANVAS_WIDTH = 1000;
            const MAX_CANVAS_HEIGHT = 620;
            canvas.width = Math.min(MAX_CANVAS_WIDTH, Math.max(320, Math.floor(parent.clientWidth)));
            canvas.height = Math.min(MAX_CANVAS_HEIGHT, Math.max(240, Math.floor(parent.clientHeight)));
            // Invalidate cached gradients so they get rebuilt at the new size.
            skyGradientRef.current = null;
            fogGradientRef.current = null;
            cachedGradientHeightRef.current = 0;
        };

        resizeCanvas();
        resetGame();

        const parseLeaderboard = (raw: string | null) => {
            if (!raw) {
                return [] as number[];
            }

            try {
                const parsed = JSON.parse(raw) as unknown;
                if (!Array.isArray(parsed)) {
                    return [];
                }

                return parsed
                    .map((value) => (typeof value === 'number' ? value : Number(value)))
                    .filter((value) => Number.isFinite(value) && value >= 0)
                    .map((value) => Math.floor(value))
                    .sort((a, b) => b - a)
                    .slice(0, 5);
            } catch {
                return [];
            }
        };

        leaderboardRef.current = parseLeaderboard(window.localStorage.getItem(LEADERBOARD_STORAGE_KEY));
        if (leaderboardRef.current.length > 0) {
            bestScoreRef.current = Math.max(bestScoreRef.current, leaderboardRef.current[0]);
        }

        // Load studs and skins from localStorage
        const savedStuds = parseInt(window.localStorage.getItem(STUDS_STORAGE_KEY) ?? '0', 10);
        studsRef.current = Number.isFinite(savedStuds) && savedStuds >= 0 ? savedStuds : 0;

        const savedUnlocked = window.localStorage.getItem(UNLOCKED_SKINS_STORAGE_KEY);
        const parsedUnlocked = new Set<CarSkinId>(['bumble']);
        if (savedUnlocked) {
            try {
                const arr = JSON.parse(savedUnlocked) as unknown;
                if (Array.isArray(arr)) {
                    arr.forEach((id) => {
                        if (CAR_SKINS.some((s) => s.id === id)) {
                            parsedUnlocked.add(id as CarSkinId);
                        }
                    });
                }
            } catch { /* ignore */ }
        }
        unlockedSkinsRef.current = parsedUnlocked;

        const savedSkin = window.localStorage.getItem(SELECTED_SKIN_STORAGE_KEY) as CarSkinId | null;
        let initialSelectedSkin: CarSkinId = selectedSkinRef.current;
        if (savedSkin && parsedUnlocked.has(savedSkin)) {
            selectedSkinRef.current = savedSkin;
            initialSelectedSkin = savedSkin;
        }

        const savedVehicle = window.localStorage.getItem(SELECTED_VEHICLE_STORAGE_KEY);
        let initialSelectedVehicle: VehicleType = selectedVehicleRef.current;
        if (savedVehicle === 'car' || savedVehicle === 'motorcycle') {
            selectedVehicleRef.current = savedVehicle;
            initialSelectedVehicle = savedVehicle;
        }

        const savedMotorcyclesUnlocked = window.localStorage.getItem(MOTORCYCLES_UNLOCKED_STORAGE_KEY) === '1';
        motorcyclesUnlockedRef.current = savedMotorcyclesUnlocked;
        const savedMobilesUnlocked = window.localStorage.getItem(MOBILES_UNLOCKED_STORAGE_KEY) === '1';
        mobilesUnlockedRef.current = savedMobilesUnlocked;
        const savedPoliceStreakRaw = window.localStorage.getItem(POLICE_FULL_HEALTH_DEATHS_STORAGE_KEY);
        const parsedPoliceStreak = savedPoliceStreakRaw === null ? 0 : Number.parseInt(savedPoliceStreakRaw, 10);
        policeFullHealthDeathsRef.current = Number.isFinite(parsedPoliceStreak) ? Math.max(0, parsedPoliceStreak) : 0;
        if (!savedMotorcyclesUnlocked && selectedVehicleRef.current === 'motorcycle') {
            selectedVehicleRef.current = 'car';
            initialSelectedVehicle = 'car';
            window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'car');
        }

        const savedUnlockedMotorcycles = window.localStorage.getItem(UNLOCKED_MOTORCYCLE_SKINS_STORAGE_KEY);
        const parsedUnlockedMotorcycles = new Set<MotorcycleSkinId>(['street']);
        if (savedUnlockedMotorcycles) {
            try {
                const arr = JSON.parse(savedUnlockedMotorcycles) as unknown;
                if (Array.isArray(arr)) {
                    arr.forEach((id) => {
                        if (MOTORCYCLE_SKINS.some((s) => s.id === id)) {
                            parsedUnlockedMotorcycles.add(id as MotorcycleSkinId);
                        }
                    });
                }
            } catch { /* ignore */ }
        }
        unlockedMotorcycleSkinsRef.current = parsedUnlockedMotorcycles;

        const savedMotorcycleSkin = window.localStorage.getItem(SELECTED_MOTORCYCLE_SKIN_STORAGE_KEY) as MotorcycleSkinId | null;
        let initialSelectedMotorcycleSkin: MotorcycleSkinId = selectedMotorcycleSkinRef.current;
        if (savedMotorcycleSkin && parsedUnlockedMotorcycles.has(savedMotorcycleSkin)) {
            selectedMotorcycleSkinRef.current = savedMotorcycleSkin;
            initialSelectedMotorcycleSkin = savedMotorcycleSkin;
        }

        gameStatsRef.current.skinsOwned = unlockedSkinsRef.current.size + (motorcyclesUnlockedRef.current ? unlockedMotorcycleSkinsRef.current.size : 0);

        // Load persistent stats
        try {
            const rawStats = window.localStorage.getItem(STATS_STORAGE_KEY);
            if (rawStats) {
                const parsed = JSON.parse(rawStats) as Partial<GameStats>;
                Object.assign(gameStatsRef.current, parsed);
            }
        } catch { /* ignore */ }

        // Load unlocked achievements
        try {
            const rawAch = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
            if (rawAch) {
                const arr = JSON.parse(rawAch) as unknown;
                if (Array.isArray(arr)) {
                    arr.forEach((id) => {
                        if (ACHIEVEMENTS.some((a) => a.id === id)) {
                            unlockedAchievementsRef.current.add(id as AchievementId);
                        }
                    });
                }
            }
        } catch { /* ignore */ }

        // Single batched UI update for all loaded values
        updateUi({
            studs: studsRef.current,
            unlockedSkins: new Set(parsedUnlocked),
            selectedSkin: initialSelectedSkin,
            selectedVehicle: initialSelectedVehicle,
            motorcyclesUnlocked: savedMotorcyclesUnlocked,
            mobilesUnlocked: savedMobilesUnlocked,
            unlockedMotorcycleSkins: new Set(parsedUnlockedMotorcycles),
            selectedMotorcycleSkin: initialSelectedMotorcycleSkin,
            unlockedAchievements: new Set(unlockedAchievementsRef.current),
        });

        const tryApplyComboBonus = () => {
            const allComboKeysDown = comboKeysHeldRef.current.KeyC && comboKeysHeldRef.current.KeyH && comboKeysHeldRef.current.KeyR;
            if (!allComboKeysDown || comboAwardedRef.current || !isGameStartedRef.current || isGameOverRef.current) {
                return;
            }

            comboAwardedRef.current = true;
            scoreAccumulatorRef.current += 1000;
            scoreRef.current = Math.floor(scoreAccumulatorRef.current);
            if (scoreRef.current > bestScoreRef.current) {
                bestScoreRef.current = scoreRef.current;
            }
        };

        const keyListener = (event: KeyboardEvent) => {
            if (event.code === 'KeyF' || event.code === 'KeyR' || event.code === 'KeyE') {
                developerTapComboRef.current[event.code] = true;
                const hasTappedCombo = developerTapComboRef.current.KeyF && developerTapComboRef.current.KeyR && developerTapComboRef.current.KeyE;
                if (hasTappedCombo) {
                    developerModeRef.current = !developerModeRef.current;
                    updateUi({ isDeveloperMode: developerModeRef.current });
                    developerTapComboRef.current = { KeyF: false, KeyR: false, KeyE: false };
                }
            }

            if (event.code === 'KeyC' || event.code === 'KeyH' || event.code === 'KeyR') {
                comboKeysHeldRef.current[event.code] = true;
                tryApplyComboBonus();
            }

            if (!isGameStartedRef.current) {
                if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Enter') {
                    event.preventDefault();
                    startGame();
                }
                return;
            }

            if (event.code === 'Escape' && !isGameOverRef.current) {
                event.preventDefault();
                const nextPaused = !isPausedRef.current;
                isPausedRef.current = nextPaused;
                return;
            }

            if (isPausedRef.current) {
                return;
            }

            if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
                event.preventDefault();
                moveLane(-1);
                return;
            }

            if (event.code === 'ArrowRight' || event.code === 'KeyD') {
                event.preventDefault();
                moveLane(1);
                return;
            }

            if ((event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') && isGameOverRef.current) {
                event.preventDefault();
                resetGame();
            }
        };

        const keyUpListener = (event: KeyboardEvent) => {
            if (event.code === 'KeyC' || event.code === 'KeyH' || event.code === 'KeyR') {
                comboKeysHeldRef.current[event.code] = false;
                comboAwardedRef.current = false;
            }
        };

        const drawCar = (
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number,
            color: string,
            windshield: string
        ) => {
            const radius = Math.max(6, width * 0.18);
            const wheelWidth = Math.max(5, width * 0.18);
            const wheelHeight = Math.max(9, height * 0.15);

            context.fillStyle = '#111111';
            context.fillRect(x - 2, y + (height * 0.18), wheelWidth, wheelHeight);
            context.fillRect(x + width - wheelWidth + 2, y + (height * 0.18), wheelWidth, wheelHeight);
            context.fillRect(x - 2, y + (height * 0.68), wheelWidth, wheelHeight);
            context.fillRect(x + width - wheelWidth + 2, y + (height * 0.68), wheelWidth, wheelHeight);

            context.fillStyle = color;
            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
            context.closePath();
            context.fill();

            context.fillStyle = windshield;
            context.beginPath();
            context.roundRect(x + (width * 0.18), y + (height * 0.14), width * 0.64, height * 0.24, radius * 0.6);
            context.fill();
            context.beginPath();
            context.roundRect(x + (width * 0.24), y + (height * 0.48), width * 0.52, height * 0.22, radius * 0.45);
            context.fill();

            context.fillStyle = 'rgba(255, 255, 255, 0.18)';
            context.fillRect(x + (width * 0.14), y + (height * 0.08), width * 0.12, height * 0.82);

            context.fillStyle = '#ffd54f';
            context.fillRect(x + (width * 0.1), y + (height * 0.04), width * 0.16, height * 0.06);
            context.fillRect(x + (width * 0.74), y + (height * 0.04), width * 0.16, height * 0.06);

            context.fillStyle = '#d32f2f';
            context.fillRect(x + (width * 0.12), y + (height * 0.9), width * 0.14, height * 0.05);
            context.fillRect(x + (width * 0.74), y + (height * 0.9), width * 0.14, height * 0.05);
        };

        const drawCarWrap = (
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number,
            wrap: string,
            time: number
        ) => {
            const radius = Math.max(6, width * 0.18);
            const isMotorcycleWrap = wrap.startsWith('moto_');
            context.save();
            if (isMotorcycleWrap) {
                // Clip wraps to bike fairing/tank area so effects do not bleed outside the motorcycle.
                context.beginPath();
                context.roundRect(
                    x + width * 0.31,
                    y + height * 0.17,
                    width * 0.38,
                    height * 0.63,
                    Math.max(4, width * 0.09)
                );
                context.rect(
                    x + width * 0.40,
                    y + height * 0.09,
                    width * 0.20,
                    height * 0.14
                );
            } else {
                context.beginPath();
                context.moveTo(x + radius, y);
                context.lineTo(x + width - radius, y);
                context.quadraticCurveTo(x + width, y, x + width, y + radius);
                context.lineTo(x + width, y + height - radius);
                context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                context.lineTo(x + radius, y + height);
                context.quadraticCurveTo(x, y + height, x, y + height - radius);
                context.lineTo(x, y + radius);
                context.quadraticCurveTo(x, y, x + radius, y);
                context.closePath();
            }
            context.clip();

            if (wrap === 'stripes_black') {
                context.fillStyle = 'rgba(0,0,0,0.50)';
                const sw = width * 0.19;
                const skew = height * 0.28;
                context.beginPath();
                context.moveTo(x + width * 0.26, y);
                context.lineTo(x + width * 0.26 + sw, y);
                context.lineTo(x + width * 0.26 + sw - skew, y + height);
                context.lineTo(x + width * 0.26 - skew, y + height);
                context.closePath();
                context.fill();
                context.beginPath();
                context.moveTo(x + width * 0.60, y);
                context.lineTo(x + width * 0.60 + sw, y);
                context.lineTo(x + width * 0.60 + sw - skew, y + height);
                context.lineTo(x + width * 0.60 - skew, y + height);
                context.closePath();
                context.fill();
            } else if (wrap === 'stripes_red') {
                context.fillStyle = '#e53935';
                const sw = width * 0.11;
                context.fillRect(x + width * 0.37, y, sw, height);
                context.fillRect(x + width * 0.52, y, sw, height);
            } else if (wrap === 'checker') {
                const cols = 4;
                const startY = y + height * 0.54;
                const cellW = width / cols;
                const cellH = (height * 0.38) / 2;
                context.fillStyle = 'rgba(255,255,255,0.76)';
                for (let row = 0; row < 2; row++) {
                    for (let col = 0; col < cols; col++) {
                        if ((row + col) % 2 === 0) {
                            context.fillRect(x + col * cellW, startY + row * cellH, cellW, cellH);
                        }
                    }
                }
            } else if (wrap === 'flames') {
                const bY = y + height;
                context.fillStyle = '#ff6d00';
                context.beginPath();
                context.moveTo(x + width * 0.10, bY);
                context.bezierCurveTo(x + width * 0.06, bY - height * 0.38, x + width * 0.22, bY - height * 0.60, x + width * 0.26, bY - height * 0.32);
                context.bezierCurveTo(x + width * 0.29, bY - height * 0.48, x + width * 0.36, bY - height * 0.22, x + width * 0.38, bY);
                context.closePath();
                context.fill();
                context.beginPath();
                context.moveTo(x + width * 0.62, bY);
                context.bezierCurveTo(x + width * 0.64, bY - height * 0.22, x + width * 0.71, bY - height * 0.48, x + width * 0.74, bY - height * 0.32);
                context.bezierCurveTo(x + width * 0.78, bY - height * 0.60, x + width * 0.94, bY - height * 0.38, x + width * 0.90, bY);
                context.closePath();
                context.fill();
                context.fillStyle = '#ffea00';
                const cx = x + width * 0.5;
                context.beginPath();
                context.moveTo(cx - width * 0.10, bY);
                context.bezierCurveTo(cx - width * 0.13, bY - height * 0.28, cx, bY - height * 0.58, cx + width * 0.13, bY - height * 0.28);
                context.bezierCurveTo(cx + width * 0.10, bY - height * 0.12, cx + width * 0.08, bY, cx - width * 0.10, bY);
                context.closePath();
                context.fill();
            } else if (wrap === 'carbon') {
                const gs = Math.max(3, width * 0.14);
                context.strokeStyle = 'rgba(255,255,255,0.10)';
                context.lineWidth = 0.8;
                for (let gx = x; gx <= x + width; gx += gs) {
                    context.beginPath(); context.moveTo(gx, y); context.lineTo(gx, y + height); context.stroke();
                }
                for (let gy = y; gy <= y + height; gy += gs) {
                    context.beginPath(); context.moveTo(x, gy); context.lineTo(x + width, gy); context.stroke();
                }
                context.strokeStyle = 'rgba(255,255,255,0.05)';
                for (let gx = x - height; gx < x + width + height; gx += gs) {
                    context.beginPath(); context.moveTo(gx, y); context.lineTo(gx + height, y + height); context.stroke();
                }
            } else if (wrap.startsWith('galaxy') || wrap.startsWith('moto_galaxy')) {
                const galaxyPalettes: Record<string, [string, string]> = {
                    galaxy: ['#e91e63', '#673ab7'],
                    moto_galaxy_orbit: ['#26c6da', '#7e57c2'],
                    moto_galaxy_warp: ['#ef5350', '#42a5f5'],
                };
                const [c1, c2] = galaxyPalettes[wrap] ?? ['#e91e63', '#673ab7'];
                const shimmer = 0.55 + Math.sin(time * 0.003) * 0.3;
                const stars: [number, number, number][] = [
                    [0.15, 0.12, 0.042], [0.42, 0.09, 0.036], [0.80, 0.18, 0.048],
                    [0.22, 0.40, 0.030], [0.65, 0.32, 0.038], [0.88, 0.46, 0.032],
                    [0.35, 0.65, 0.044], [0.58, 0.74, 0.034], [0.76, 0.62, 0.040],
                    [0.10, 0.82, 0.030], [0.50, 0.88, 0.038], [0.92, 0.80, 0.034],
                ];
                for (const [sx, sy, sr] of stars) {
                    const alpha = shimmer * (0.7 + Math.sin(time * 0.004 + sx * 10) * 0.3);
                    context.fillStyle = `rgba(255,255,255,${alpha})`;
                    context.beginPath();
                    context.arc(x + sx * width, y + sy * height, Math.max(1, sr * width), 0, Math.PI * 2);
                    context.fill();
                }
                const grad = context.createLinearGradient(x, y, x + width, y + height);
                grad.addColorStop(0, `${c1}${Math.floor((0.12 + Math.sin(time * 0.002) * 0.07) * 255).toString(16).padStart(2, '0')}`);
                grad.addColorStop(0.5, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `${c2}${Math.floor((0.12 + Math.cos(time * 0.002) * 0.07) * 255).toString(16).padStart(2, '0')}`);
                context.fillStyle = grad;
                context.fillRect(x, y, width, height);
            } else if (wrap === 'neon_stream') {
                const offset = ((time * 0.14) % (width * 1.8)) - width;
                context.fillStyle = 'rgba(0, 229, 255, 0.28)';
                for (let i = -2; i < 5; i++) {
                    const sx = x + offset + i * (width * 0.35);
                    context.beginPath();
                    context.moveTo(sx, y + height);
                    context.lineTo(sx + width * 0.18, y + height);
                    context.lineTo(sx + width * 0.52, y);
                    context.lineTo(sx + width * 0.34, y);
                    context.closePath();
                    context.fill();
                }
                context.fillStyle = 'rgba(255,255,255,0.14)';
                context.fillRect(x, y + height * 0.38, width, height * 0.08);
            } else if (wrap === 'pulse_grid') {
                const pulse = 0.35 + Math.sin(time * 0.01) * 0.25;
                const cell = Math.max(5, width * 0.14);
                context.strokeStyle = `rgba(124, 252, 0, ${0.25 + pulse})`;
                context.lineWidth = 1.2;
                for (let gx = x; gx <= x + width; gx += cell) {
                    context.beginPath();
                    context.moveTo(gx, y);
                    context.lineTo(gx, y + height);
                    context.stroke();
                }
                for (let gy = y; gy <= y + height; gy += cell) {
                    context.beginPath();
                    context.moveTo(x, gy);
                    context.lineTo(x + width, gy);
                    context.stroke();
                }
            } else if (wrap === 'thunder_wave') {
                const wave = Math.sin(time * 0.01) * height * 0.08;
                context.strokeStyle = 'rgba(255, 255, 255, 0.75)';
                context.lineWidth = Math.max(2, width * 0.04);
                for (let i = 0; i < 3; i++) {
                    const yy = y + height * (0.22 + i * 0.24);
                    context.beginPath();
                    context.moveTo(x, yy);
                    context.bezierCurveTo(x + width * 0.25, yy - wave, x + width * 0.5, yy + wave, x + width * 0.75, yy - wave);
                    context.bezierCurveTo(x + width * 0.88, yy + wave, x + width * 0.94, yy, x + width, yy);
                    context.stroke();
                }
                context.strokeStyle = 'rgba(103, 58, 183, 0.45)';
                context.lineWidth = Math.max(1, width * 0.02);
                context.strokeRect(x + width * 0.08, y + height * 0.14, width * 0.84, height * 0.72);
            } else if (wrap === 'lava_flow') {
                const t = time * 0.004;
                const bands = 4;
                for (let i = 0; i < bands; i++) {
                    const yy = y + (i / bands) * height;
                    const amp = height * 0.08;
                    const phase = t + i * 0.9;
                    context.fillStyle = i % 2 === 0 ? 'rgba(255, 87, 34, 0.55)' : 'rgba(255, 193, 7, 0.42)';
                    context.beginPath();
                    context.moveTo(x, yy);
                    for (let px = 0; px <= width; px += width / 8) {
                        const py = yy + Math.sin((px / width) * Math.PI * 2 + phase) * amp;
                        context.lineTo(x + px, py);
                    }
                    context.lineTo(x + width, yy + height / bands + amp);
                    context.lineTo(x, yy + height / bands + amp);
                    context.closePath();
                    context.fill();
                }
            } else if (wrap === 'holo_shift') {
                const shift = (Math.sin(time * 0.006) + 1) * 0.5;
                const grad = context.createLinearGradient(x, y, x + width, y + height);
                grad.addColorStop(0, `rgba(255, 64, 129, ${0.26 + shift * 0.2})`);
                grad.addColorStop(0.35, `rgba(0, 229, 255, ${0.22 + (1 - shift) * 0.2})`);
                grad.addColorStop(0.7, `rgba(124, 77, 255, ${0.24 + shift * 0.18})`);
                grad.addColorStop(1, 'rgba(255, 255, 255, 0.10)');
                context.fillStyle = grad;
                context.fillRect(x, y, width, height);
                const scanY = y + ((time * 0.08) % height);
                context.fillStyle = 'rgba(255,255,255,0.25)';
                context.fillRect(x, scanY, width, Math.max(2, height * 0.06));
            } else if (wrap === 'matrix_rain') {
                const cols = 8;
                const colW = width / cols;
                for (let c = 0; c < cols; c++) {
                    const speed = 0.045 + c * 0.003;
                    const streamY = ((time * speed) % (height + height * 0.4)) - height * 0.2;
                    const xx = x + c * colW;
                    context.fillStyle = 'rgba(76, 175, 80, 0.32)';
                    context.fillRect(xx + colW * 0.25, y, colW * 0.5, height);
                    context.fillStyle = 'rgba(178, 255, 89, 0.82)';
                    context.fillRect(xx + colW * 0.3, y + streamY, colW * 0.4, Math.max(3, height * 0.08));
                }
            } else if (wrap === 'nate') {
                // === Nate-Mobile: purple plasma flaming wheels + lightning emblem + shimmer sweep + glowing tag ===
                const wheelW = Math.max(5, width * 0.18);
                const wheelH = Math.max(9, height * 0.15);
                const wheelSpots: Array<{ wx: number; wy: number; back: boolean }> = [
                    { wx: x - 2,                          wy: y + height * 0.18, back: false },
                    { wx: x + width - wheelW + 2,         wy: y + height * 0.18, back: false },
                    { wx: x - 2,                          wy: y + height * 0.68, back: true  },
                    { wx: x + width - wheelW + 2,         wy: y + height * 0.68, back: true  },
                ];

                // Per-wheel animated flame plume — now purple-magenta with white-hot core.
                for (let i = 0; i < wheelSpots.length; i += 1) {
                    const { wx, wy, back } = wheelSpots[i];
                    const cx = wx + wheelW / 2;
                    const baseFlick = 0.85 + Math.sin(time * 0.018 + i * 1.7) * 0.18 + Math.sin(time * 0.041 + i) * 0.06;
                    const flameUp = wheelH * 1.7 * baseFlick;
                    const flameDown = wheelH * 1.15 * baseFlick;
                    const flameWidth = wheelW * 1.7;

                    // Outer deep-purple halo.
                    const haloGrad = context.createRadialGradient(cx, wy + wheelH / 2, wheelW * 0.2, cx, wy + wheelH / 2, flameWidth);
                    haloGrad.addColorStop(0, 'rgba(186,85,211,0.6)');
                    haloGrad.addColorStop(0.55, 'rgba(123,31,162,0.25)');
                    haloGrad.addColorStop(1, 'rgba(40,0,60,0)');
                    context.fillStyle = haloGrad;
                    context.beginPath();
                    context.ellipse(cx, wy + wheelH / 2, flameWidth, (flameUp + flameDown) * 0.55, 0, 0, Math.PI * 2);
                    context.fill();

                    // Mid magenta flame body.
                    const magentaG = Math.floor(60 + Math.sin(time * 0.02 + i) * 30);
                    context.fillStyle = `rgba(220,${magentaG},220,0.9)`;
                    context.beginPath();
                    context.moveTo(cx - wheelW * 0.55, wy + wheelH * 0.5);
                    context.bezierCurveTo(
                        cx - wheelW * 0.9, wy - flameUp * 0.4,
                        cx - wheelW * 0.2, wy - flameUp * 0.9,
                        cx, wy - flameUp,
                    );
                    context.bezierCurveTo(
                        cx + wheelW * 0.2, wy - flameUp * 0.9,
                        cx + wheelW * 0.9, wy - flameUp * 0.4,
                        cx + wheelW * 0.55, wy + wheelH * 0.5,
                    );
                    context.bezierCurveTo(
                        cx + wheelW * 0.9, wy + wheelH + flameDown * 0.5,
                        cx + wheelW * 0.2, wy + wheelH + flameDown,
                        cx, wy + wheelH + flameDown * 0.95,
                    );
                    context.bezierCurveTo(
                        cx - wheelW * 0.2, wy + wheelH + flameDown,
                        cx - wheelW * 0.9, wy + wheelH + flameDown * 0.5,
                        cx - wheelW * 0.55, wy + wheelH * 0.5,
                    );
                    context.closePath();
                    context.fill();

                    // Inner white-hot core.
                    const coreFlick = 0.7 + Math.sin(time * 0.03 + i * 2.1) * 0.25;
                    context.fillStyle = 'rgba(255,235,255,0.95)';
                    context.beginPath();
                    context.moveTo(cx - wheelW * 0.28, wy + wheelH * 0.5);
                    context.bezierCurveTo(
                        cx - wheelW * 0.45, wy - flameUp * 0.25 * coreFlick,
                        cx - wheelW * 0.1, wy - flameUp * 0.55 * coreFlick,
                        cx, wy - flameUp * 0.6 * coreFlick,
                    );
                    context.bezierCurveTo(
                        cx + wheelW * 0.1, wy - flameUp * 0.55 * coreFlick,
                        cx + wheelW * 0.45, wy - flameUp * 0.25 * coreFlick,
                        cx + wheelW * 0.28, wy + wheelH * 0.5,
                    );
                    context.bezierCurveTo(
                        cx + wheelW * 0.45, wy + wheelH + flameDown * 0.35 * coreFlick,
                        cx + wheelW * 0.1, wy + wheelH + flameDown * 0.6 * coreFlick,
                        cx, wy + wheelH + flameDown * 0.62 * coreFlick,
                    );
                    context.bezierCurveTo(
                        cx - wheelW * 0.1, wy + wheelH + flameDown * 0.6 * coreFlick,
                        cx - wheelW * 0.45, wy + wheelH + flameDown * 0.35 * coreFlick,
                        cx - wheelW * 0.28, wy + wheelH * 0.5,
                    );
                    context.closePath();
                    context.fill();

                    // Trailing purple embers from rear wheels.
                    if (back) {
                        for (let e = 0; e < 4; e += 1) {
                            const t = ((time * 0.4 + i * 53 + e * 90) % 360) / 360;
                            const ey = wy + wheelH + t * height * 0.5;
                            const ex = cx + Math.sin((time * 0.01) + e + i) * wheelW * 0.4;
                            const alpha = 1 - t;
                            context.fillStyle = `rgba(${200 + Math.floor(Math.random() * 40)},${80 + Math.floor(Math.random() * 60)},${220 + Math.floor(Math.random() * 30)},${alpha * 0.9})`;
                            context.beginPath();
                            context.arc(ex, ey, Math.max(1, wheelW * 0.12 * (1 - t * 0.6)), 0, Math.PI * 2);
                            context.fill();
                        }
                    }
                }

                // Diagonal animated purple shimmer sweeping across the body.
                const sweepX = x - width + ((time * 0.18) % (width * 2.5));
                const shimmerGrad = context.createLinearGradient(sweepX, y, sweepX + width * 1.2, y + height);
                shimmerGrad.addColorStop(0, 'rgba(186,85,211,0)');
                shimmerGrad.addColorStop(0.45, 'rgba(220,120,255,0.45)');
                shimmerGrad.addColorStop(0.5, 'rgba(255,200,255,0.7)');
                shimmerGrad.addColorStop(0.55, 'rgba(220,120,255,0.45)');
                shimmerGrad.addColorStop(1, 'rgba(186,85,211,0)');
                context.fillStyle = shimmerGrad;
                context.fillRect(x, y, width, height);

                // Lightning-bolt emblem on the hood (purple-fill, white outline).
                const eX = x + width / 2;
                const eY = y + height * 0.32;
                const eS = width * 0.22;
                context.shadowColor = '#e040fb';
                context.shadowBlur = 9 + Math.sin(time * 0.012) * 3;
                context.fillStyle = '#ce93d8';
                context.strokeStyle = '#ffffff';
                context.lineWidth = Math.max(1, width * 0.025);
                context.beginPath();
                context.moveTo(eX - eS * 0.3, eY - eS * 0.7);
                context.lineTo(eX + eS * 0.4, eY - eS * 0.7);
                context.lineTo(eX - eS * 0.05, eY + eS * 0.05);
                context.lineTo(eX + eS * 0.25, eY + eS * 0.05);
                context.lineTo(eX - eS * 0.4, eY + eS * 0.8);
                context.lineTo(eX, eY + eS * 0.15);
                context.lineTo(eX - eS * 0.3, eY + eS * 0.15);
                context.closePath();
                context.fill();
                context.stroke();
                context.shadowBlur = 0;

                // Floating purple plasma orbs rising along both sides.
                for (let o = 0; o < 6; o += 1) {
                    const phase = (time * 0.05 + o * 67) % 100;
                    const side = o % 2 === 0 ? -1 : 1;
                    const ox = x + width / 2 + side * width * (0.42 + Math.sin(time * 0.006 + o) * 0.06);
                    const oy = y + height * (1 - phase / 100);
                    const orbR = Math.max(1.4, width * 0.07 * (1 - phase / 200));
                    const orbAlpha = 0.55 * (1 - phase / 100);
                    context.shadowColor = '#e040fb';
                    context.shadowBlur = 8;
                    context.fillStyle = `rgba(220,140,255,${orbAlpha})`;
                    context.beginPath();
                    context.arc(ox, oy, orbR, 0, Math.PI * 2);
                    context.fill();
                }
                context.shadowBlur = 0;

                // Twin neon racing stripes — now layered purple over magenta.
                const glowPulse = 0.6 + Math.sin(time * 0.006) * 0.25;
                context.fillStyle = `rgba(123,31,162,${0.85 * glowPulse})`;
                context.fillRect(x + width * 0.41, y + height * 0.05, width * 0.05, height * 0.78);
                context.fillRect(x + width * 0.54, y + height * 0.05, width * 0.05, height * 0.78);
                context.fillStyle = `rgba(255,180,255,${0.7 * glowPulse})`;
                context.fillRect(x + width * 0.42, y + height * 0.05, width * 0.025, height * 0.78);
                context.fillRect(x + width * 0.555, y + height * 0.05, width * 0.025, height * 0.78);

                // Stronger purple underglow stripe.
                const underGrad = context.createLinearGradient(x, y + height * 0.95, x, y + height * 1.3);
                underGrad.addColorStop(0, `rgba(186,85,211,${0.75 * glowPulse})`);
                underGrad.addColorStop(0.5, `rgba(224,64,251,${0.45 * glowPulse})`);
                underGrad.addColorStop(1, 'rgba(186,85,211,0)');
                context.fillStyle = underGrad;
                context.fillRect(x - width * 0.15, y + height * 0.95, width * 1.3, height * 0.35);

                // Glowing "Nate-Mobile" tag with double glow.
                const fontSize = Math.max(7, height * 0.1);
                context.save();
                context.font = `900 ${fontSize}px sans-serif`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                const tx = x + width / 2;
                const ty = y + height * 0.86;
                context.shadowColor = '#e040fb';
                context.shadowBlur = 12 + Math.sin(time * 0.01) * 4;
                context.lineWidth = Math.max(1.5, fontSize * 0.24);
                context.strokeStyle = 'rgba(20,0,40,0.95)';
                context.strokeText('Nate-Mobile', tx, ty);
                context.fillStyle = '#f3e5ff';
                context.fillText('Nate-Mobile', tx, ty);
                context.restore();
            } else if (wrap === 'esben') {
                // === Esben skin: frozen body with crackling lightning bolts ===
                // Frosty hood gradient
                const frostGrad = context.createLinearGradient(x, y, x, y + height);
                frostGrad.addColorStop(0, 'rgba(225,245,255,0.85)');
                frostGrad.addColorStop(0.5, 'rgba(120,200,240,0.35)');
                frostGrad.addColorStop(1, 'rgba(13,71,161,0)');
                context.fillStyle = frostGrad;
                context.fillRect(x, y, width, height * 0.6);

                // Jagged ice crystals along the top
                context.fillStyle = 'rgba(255,255,255,0.85)';
                for (let i = 0; i < 5; i += 1) {
                    const cxIce = x + width * (0.1 + i * 0.2);
                    const baseY = y + height * 0.05;
                    context.beginPath();
                    context.moveTo(cxIce - width * 0.05, baseY + height * 0.06);
                    context.lineTo(cxIce, baseY - height * 0.04);
                    context.lineTo(cxIce + width * 0.05, baseY + height * 0.06);
                    context.closePath();
                    context.fill();
                }

                // Animated electric bolts down both sides (zig-zag, flickers)
                const boltPhase = Math.floor(time / 90) % 4;
                context.strokeStyle = `rgba(140,220,255,${0.7 + Math.sin(time * 0.02) * 0.3})`;
                context.lineWidth = Math.max(1.2, width * 0.025);
                context.shadowColor = '#7cdcff';
                context.shadowBlur = 8;
                for (const side of [-1, 1] as const) {
                    const sx = side === -1 ? x + width * 0.05 : x + width * 0.95;
                    context.beginPath();
                    context.moveTo(sx, y + height * 0.1);
                    for (let s = 1; s <= 6; s += 1) {
                        const offset = ((s + boltPhase) % 2 === 0 ? 1 : -1) * width * 0.08;
                        context.lineTo(sx + offset, y + height * (0.1 + s * 0.13));
                    }
                    context.stroke();
                }
                context.shadowBlur = 0;

                // Glowing snowflake emblem on hood
                const snowCx = x + width / 2;
                const snowCy = y + height * 0.32;
                const snowR = width * 0.18;
                context.strokeStyle = 'rgba(230,250,255,0.95)';
                context.lineWidth = Math.max(1, width * 0.03);
                for (let a = 0; a < 6; a += 1) {
                    const ang = (a / 6) * Math.PI * 2;
                    context.beginPath();
                    context.moveTo(snowCx, snowCy);
                    context.lineTo(snowCx + Math.cos(ang) * snowR, snowCy + Math.sin(ang) * snowR);
                    context.stroke();
                }

                // "Esben-Mobile" tag on the back with icy glow
                const fontSize = Math.max(7, height * 0.09);
                context.save();
                context.font = `900 ${fontSize}px sans-serif`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                const tx = x + width / 2;
                const ty = y + height * 0.86;
                context.shadowColor = '#7cdcff';
                context.shadowBlur = 9 + Math.sin(time * 0.012) * 3;
                context.lineWidth = Math.max(1.5, fontSize * 0.22);
                context.strokeStyle = 'rgba(0,20,40,0.85)';
                context.strokeText('Esben-Mobile', tx, ty);
                context.fillStyle = '#e1f5ff';
                context.fillText('Esben-Mobile', tx, ty);
                context.restore();
            } else if (wrap === 'jakob') {
                // === Jakob skin: toxic / biohazard, dripping slime, glowing bubbles ===
                // Bright slime overlay on hood
                const slimeGrad = context.createLinearGradient(x, y, x, y + height);
                slimeGrad.addColorStop(0, 'rgba(170,255,90,0.85)');
                slimeGrad.addColorStop(0.6, 'rgba(120,220,40,0.45)');
                slimeGrad.addColorStop(1, 'rgba(27,94,32,0)');
                context.fillStyle = slimeGrad;
                context.fillRect(x, y, width, height * 0.55);

                // Slime drips along the bottom of the front section (wavy bottom edge)
                context.fillStyle = 'rgba(140,240,60,0.9)';
                context.beginPath();
                context.moveTo(x, y + height * 0.55);
                for (let i = 0; i <= 8; i += 1) {
                    const dx = x + (width * i) / 8;
                    const dy = y + height * 0.55 + Math.abs(Math.sin(i + time * 0.003)) * height * 0.06;
                    context.lineTo(dx, dy);
                }
                context.lineTo(x + width, y + height * 0.5);
                context.lineTo(x, y + height * 0.5);
                context.closePath();
                context.fill();

                // Floating glowing bubbles
                context.shadowColor = '#aaff5a';
                context.shadowBlur = 10;
                for (let b = 0; b < 6; b += 1) {
                    const phase = (time * 0.06 + b * 60) % 360;
                    const bx = x + width * (0.15 + (b * 0.13) % 0.7);
                    const by = y + height * (0.95 - (phase / 360) * 0.9);
                    const br = Math.max(1.5, width * 0.07 * (1 - phase / 720));
                    const alpha = 0.4 + 0.4 * Math.sin(time * 0.01 + b);
                    context.fillStyle = `rgba(180,255,100,${alpha})`;
                    context.beginPath();
                    context.arc(bx, by, br, 0, Math.PI * 2);
                    context.fill();
                }
                context.shadowBlur = 0;

                // Biohazard-style tri-symbol on hood (3 rotating crescents)
                const bioCx = x + width / 2;
                const bioCy = y + height * 0.3;
                const bioR = width * 0.18;
                context.fillStyle = 'rgba(20,40,10,0.85)';
                for (let i = 0; i < 3; i += 1) {
                    const ang = (i / 3) * Math.PI * 2 + time * 0.001;
                    const ax = bioCx + Math.cos(ang) * bioR * 0.55;
                    const ay = bioCy + Math.sin(ang) * bioR * 0.55;
                    context.beginPath();
                    context.arc(ax, ay, bioR * 0.42, 0, Math.PI * 2);
                    context.fill();
                }
                context.fillStyle = '#aaff5a';
                context.beginPath();
                context.arc(bioCx, bioCy, bioR * 0.18, 0, Math.PI * 2);
                context.fill();

                // "Jakob-Mobile" tag with toxic glow
                const fontSize = Math.max(7, height * 0.09);
                context.save();
                context.font = `900 ${fontSize}px sans-serif`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                const tx = x + width / 2;
                const ty = y + height * 0.86;
                context.shadowColor = '#aaff5a';
                context.shadowBlur = 10 + Math.sin(time * 0.014) * 3;
                context.lineWidth = Math.max(1.5, fontSize * 0.22);
                context.strokeStyle = 'rgba(0,30,0,0.9)';
                context.strokeText('Jakob-Mobile', tx, ty);
                context.fillStyle = '#e9ffcf';
                context.fillText('Jakob-Mobile', tx, ty);
                context.restore();
            } else if (wrap === 'emil') {
                // === Emil skin: golden royalty with crown, gem stripes, sparkles ===
                // Animated gold sweep across the body
                const sweepX = x - width + ((time * 0.15) % (width * 2.5));
                const goldGrad = context.createLinearGradient(sweepX, y, sweepX + width * 1.4, y + height);
                goldGrad.addColorStop(0, 'rgba(255,225,100,0.0)');
                goldGrad.addColorStop(0.4, 'rgba(255,235,140,0.6)');
                goldGrad.addColorStop(0.5, 'rgba(255,255,200,0.85)');
                goldGrad.addColorStop(0.6, 'rgba(255,235,140,0.6)');
                goldGrad.addColorStop(1, 'rgba(255,225,100,0.0)');
                context.fillStyle = goldGrad;
                context.fillRect(x, y, width, height);

                // Twin gold racing stripes
                context.fillStyle = 'rgba(255,200,40,0.95)';
                context.fillRect(x + width * 0.4, y + height * 0.05, width * 0.05, height * 0.78);
                context.fillRect(x + width * 0.55, y + height * 0.05, width * 0.05, height * 0.78);

                // Crown emblem on hood
                const crX = x + width / 2;
                const crY = y + height * 0.32;
                const crW = width * 0.45;
                const crH = height * 0.13;
                context.fillStyle = '#ffd700';
                context.strokeStyle = 'rgba(80,50,0,0.85)';
                context.lineWidth = Math.max(1, width * 0.02);
                context.beginPath();
                context.moveTo(crX - crW / 2, crY + crH);
                context.lineTo(crX - crW / 2, crY);
                context.lineTo(crX - crW / 4, crY + crH * 0.5);
                context.lineTo(crX, crY - crH * 0.4);
                context.lineTo(crX + crW / 4, crY + crH * 0.5);
                context.lineTo(crX + crW / 2, crY);
                context.lineTo(crX + crW / 2, crY + crH);
                context.closePath();
                context.fill();
                context.stroke();
                // Gems on crown points
                const gemColors = ['#ff4081', '#7cdcff', '#aaff5a'];
                for (let g = 0; g < 3; g += 1) {
                    context.fillStyle = gemColors[g];
                    const gx = crX + (g - 1) * (crW / 4);
                    context.beginPath();
                    context.arc(gx, crY + crH * 0.05, Math.max(1.2, width * 0.035), 0, Math.PI * 2);
                    context.fill();
                }

                // Sparkles dancing around the car
                context.fillStyle = '#fffbcb';
                for (let s = 0; s < 7; s += 1) {
                    const sp = (time * 0.04 + s * 51) % 100;
                    const sx = x + width * ((s * 0.17) % 1);
                    const sy = y + height * (sp / 100);
                    const sr = Math.max(1, width * 0.04 * Math.abs(Math.sin(time * 0.01 + s)));
                    context.beginPath();
                    context.arc(sx, sy, sr, 0, Math.PI * 2);
                    context.fill();
                }

                // "Emil-Mobile" tag with regal glow
                const fontSize = Math.max(7, height * 0.09);
                context.save();
                context.font = `900 ${fontSize}px serif`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                const tx = x + width / 2;
                const ty = y + height * 0.86;
                context.shadowColor = '#ffd700';
                context.shadowBlur = 10 + Math.sin(time * 0.011) * 3;
                context.lineWidth = Math.max(1.5, fontSize * 0.24);
                context.strokeStyle = 'rgba(60,30,0,0.9)';
                context.strokeText('Emil-Mobile', tx, ty);
                context.fillStyle = '#fff3b0';
                context.fillText('Emil-Mobile', tx, ty);
                context.restore();
            } else if (wrap === 'kasper') {
                // === Kasper skin: ghostly black with glowing skull and floating spirits ===
                // Faint ghostly mist over body
                const mistGrad = context.createLinearGradient(x, y, x, y + height);
                mistGrad.addColorStop(0, 'rgba(60,60,75,0.0)');
                mistGrad.addColorStop(0.5, 'rgba(120,120,160,0.35)');
                mistGrad.addColorStop(1, 'rgba(20,20,30,0.0)');
                context.fillStyle = mistGrad;
                context.fillRect(x, y, width, height);

                // Glowing red eyes on the front (above the windshield area)
                context.shadowColor = '#ff2a2a';
                context.shadowBlur = 8 + Math.sin(time * 0.02) * 3;
                context.fillStyle = '#ff3838';
                const eyeY = y + height * 0.08;
                const eyeR = Math.max(1.5, width * 0.05);
                context.beginPath();
                context.arc(x + width * 0.32, eyeY, eyeR, 0, Math.PI * 2);
                context.fill();
                context.beginPath();
                context.arc(x + width * 0.68, eyeY, eyeR, 0, Math.PI * 2);
                context.fill();
                context.shadowBlur = 0;

                // Skull emblem on hood (rounded skull + 2 eye sockets + grin)
                const skX = x + width / 2;
                const skY = y + height * 0.32;
                const skR = width * 0.2;
                context.fillStyle = '#f5f5f5';
                context.beginPath();
                context.arc(skX, skY, skR, 0, Math.PI * 2);
                context.fill();
                context.fillRect(skX - skR * 0.55, skY + skR * 0.3, skR * 1.1, skR * 0.55);
                // Eye sockets
                context.fillStyle = '#0a0a0a';
                context.beginPath();
                context.arc(skX - skR * 0.4, skY - skR * 0.05, skR * 0.22, 0, Math.PI * 2);
                context.fill();
                context.beginPath();
                context.arc(skX + skR * 0.4, skY - skR * 0.05, skR * 0.22, 0, Math.PI * 2);
                context.fill();
                // Teeth
                for (let t = -2; t <= 2; t += 1) {
                    context.fillRect(skX + t * skR * 0.18 - skR * 0.06, skY + skR * 0.45, skR * 0.12, skR * 0.32);
                }

                // Floating spirit wisps along the sides (rising upward)
                for (let s = 0; s < 5; s += 1) {
                    const phase = (time * 0.05 + s * 73) % 100;
                    const side = s % 2 === 0 ? -1 : 1;
                    const wx = x + width / 2 + side * width * (0.45 + Math.sin(time * 0.005 + s) * 0.05);
                    const wy = y + height * (1 - phase / 100);
                    const alpha = 0.4 * (1 - phase / 100);
                    context.fillStyle = `rgba(200,220,255,${alpha})`;
                    context.beginPath();
                    context.ellipse(wx, wy, width * 0.06, height * 0.05, 0, 0, Math.PI * 2);
                    context.fill();
                }

                // Eerie underglow
                const underGrad = context.createLinearGradient(x, y + height * 0.95, x, y + height * 1.3);
                underGrad.addColorStop(0, `rgba(150,40,200,${0.5 + Math.sin(time * 0.005) * 0.2})`);
                underGrad.addColorStop(1, 'rgba(150,40,200,0)');
                context.fillStyle = underGrad;
                context.fillRect(x - width * 0.1, y + height * 0.95, width * 1.2, height * 0.3);

                // "Kasper-Mobile" tag with ghostly glow
                const fontSize = Math.max(7, height * 0.09);
                context.save();
                context.font = `900 ${fontSize}px sans-serif`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                const tx = x + width / 2;
                const ty = y + height * 0.86;
                context.shadowColor = '#c39bff';
                context.shadowBlur = 10 + Math.sin(time * 0.013) * 3;
                context.lineWidth = Math.max(1.5, fontSize * 0.22);
                context.strokeStyle = 'rgba(0,0,0,0.9)';
                context.strokeText('Kasper-Mobile', tx, ty);
                context.fillStyle = '#f5f5f5';
                context.fillText('Kasper-Mobile', tx, ty);
                context.restore();
            } else if (wrap === 'moto_stream') {
                context.fillStyle = 'rgba(3, 169, 244, 0.35)';
                context.beginPath();
                context.moveTo(x + width * 0.1, y + height * 0.2);
                context.lineTo(x + width * 0.9, y + height * 0.5);
                context.lineTo(x + width * 0.1, y + height * 0.8);
                context.closePath();
                context.fill();
            } else if (wrap === 'moto_pulse') {
                context.fillStyle = '#00e5ff';
                const band = height * 0.12;
                context.fillRect(x, y + height * 0.22, width, band);
                context.fillRect(x, y + height * 0.58, width, band);
            } else if (wrap === 'moto_ember') {
                context.fillStyle = '#ff7043';
                context.beginPath();
                context.moveTo(x + width * 0.1, y + height * 0.8);
                context.bezierCurveTo(x + width * 0.2, y + height * 0.4, x + width * 0.45, y + height * 0.2, x + width * 0.6, y + height * 0.75);
                context.lineTo(x + width * 0.1, y + height * 0.8);
                context.fill();
                context.fillStyle = '#ffca28';
                context.beginPath();
                context.moveTo(x + width * 0.35, y + height * 0.75);
                context.bezierCurveTo(x + width * 0.4, y + height * 0.5, x + width * 0.55, y + height * 0.45, x + width * 0.6, y + height * 0.75);
                context.fill();
            } else if (wrap === 'moto_ion') {
                context.strokeStyle = 'rgba(174, 213, 129, 0.7)';
                context.lineWidth = Math.max(2, width * 0.03);
                context.beginPath();
                context.moveTo(x + width * 0.12, y + height * 0.3);
                context.lineTo(x + width * 0.88, y + height * 0.7);
                context.stroke();
                context.beginPath();
                context.moveTo(x + width * 0.12, y + height * 0.7);
                context.lineTo(x + width * 0.88, y + height * 0.3);
                context.stroke();
            }
            context.restore();
        };

        const drawMotorcycle = (
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number,
            color: string,
            windshield: string
        ) => {
            const cx = x + width * 0.5;
            const frontY = y + height * 0.13;
            const seatY = y + height * 0.43;
            const rearY = y + height * 0.74;
            const tireY = y + height * 0.88;

            // Rear tire
            context.fillStyle = '#0f0f10';
            context.beginPath();
            context.ellipse(cx, tireY, width * 0.16, height * 0.14, 0, 0, Math.PI * 2);
            context.fill();

            // Swingarm + frame
            context.strokeStyle = '#858d99';
            context.lineWidth = Math.max(2, width * 0.045);
            context.beginPath();
            context.moveTo(cx - width * 0.12, seatY + height * 0.20);
            context.lineTo(cx - width * 0.04, rearY + height * 0.08);
            context.lineTo(cx + width * 0.12, rearY + height * 0.08);
            context.lineTo(cx + width * 0.16, tireY - height * 0.03);
            context.stroke();

            // Tank/body
            context.fillStyle = color;
            context.beginPath();
            context.roundRect(cx - width * 0.16, seatY - height * 0.08, width * 0.32, height * 0.34, Math.max(5, width * 0.10));
            context.fill();

            // Seat
            context.fillStyle = '#101214';
            context.beginPath();
            context.roundRect(cx - width * 0.18, seatY - height * 0.01, width * 0.36, height * 0.12, Math.max(4, width * 0.07));
            context.fill();

            // Rear fender + tail light
            context.fillStyle = color;
            context.beginPath();
            context.roundRect(cx - width * 0.14, rearY - height * 0.02, width * 0.28, height * 0.15, Math.max(4, width * 0.08));
            context.fill();
            context.fillStyle = '#c62828';
            context.fillRect(cx - width * 0.08, rearY + height * 0.08, width * 0.16, height * 0.035);

            // Chrome pipes (right side)
            context.strokeStyle = '#cfd8dc';
            context.lineWidth = Math.max(2, width * 0.05);
            context.beginPath();
            context.moveTo(cx + width * 0.13, rearY + height * 0.03);
            context.lineTo(cx + width * 0.28, rearY + height * 0.20);
            context.stroke();

            // Front fork / head area
            context.strokeStyle = '#9ea7b3';
            context.lineWidth = Math.max(2, width * 0.04);
            context.beginPath();
            context.moveTo(cx - width * 0.06, frontY + height * 0.06);
            context.lineTo(cx - width * 0.03, seatY - height * 0.07);
            context.moveTo(cx + width * 0.06, frontY + height * 0.06);
            context.lineTo(cx + width * 0.03, seatY - height * 0.07);
            context.stroke();

            // Handlebars + mirrors
            context.strokeStyle = '#c3ccd8';
            context.lineWidth = Math.max(2, width * 0.035);
            context.beginPath();
            context.moveTo(cx - width * 0.03, frontY + height * 0.05);
            context.lineTo(cx - width * 0.24, frontY - height * 0.02);
            context.moveTo(cx + width * 0.03, frontY + height * 0.05);
            context.lineTo(cx + width * 0.24, frontY - height * 0.02);
            context.stroke();
            context.fillStyle = '#eceff1';
            context.beginPath();
            context.ellipse(cx - width * 0.26, frontY - height * 0.035, width * 0.07, height * 0.04, -0.2, 0, Math.PI * 2);
            context.fill();
            context.beginPath();
            context.ellipse(cx + width * 0.26, frontY - height * 0.035, width * 0.07, height * 0.04, 0.2, 0, Math.PI * 2);
            context.fill();

            // Head cluster / speedometer
            context.fillStyle = windshield;
            context.beginPath();
            context.roundRect(cx - width * 0.07, frontY, width * 0.14, height * 0.12, Math.max(3, width * 0.05));
            context.fill();
            context.fillStyle = '#111';
            context.beginPath();
            context.arc(cx, frontY + height * 0.04, width * 0.03, 0, Math.PI * 2);
            context.fill();

            // Side stand hint
            context.strokeStyle = '#666';
            context.lineWidth = Math.max(2, width * 0.03);
            context.beginPath();
            context.moveTo(cx - width * 0.18, rearY + height * 0.05);
            context.lineTo(cx - width * 0.24, rearY + height * 0.18);
            context.stroke();
        };

        const drawPoliceCar = (
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number
        ) => {
            const radius = Math.max(6, width * 0.18);
            const wheelWidth = Math.max(5, width * 0.18);
            const wheelHeight = Math.max(9, height * 0.15);

            context.fillStyle = '#111111';
            context.fillRect(x - 2, y + (height * 0.18), wheelWidth, wheelHeight);
            context.fillRect(x + width - wheelWidth + 2, y + (height * 0.18), wheelWidth, wheelHeight);
            context.fillRect(x - 2, y + (height * 0.68), wheelWidth, wheelHeight);
            context.fillRect(x + width - wheelWidth + 2, y + (height * 0.68), wheelWidth, wheelHeight);

            // Police car body (blue and white stripes)
            context.fillStyle = '#1e3a8a';
            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
            context.closePath();
            context.fill();

            // White stripe
            context.fillStyle = '#ffffff';
            context.fillRect(x + (width * 0.2), y + (height * 0.35), width * 0.6, height * 0.2);

            // Red stripe
            context.fillStyle = '#dc2626';
            context.fillRect(x + (width * 0.2), y + (height * 0.58), width * 0.6, height * 0.15);

            // Windshield
            context.fillStyle = '#e0f2ff';
            context.beginPath();
            context.roundRect(x + (width * 0.18), y + (height * 0.14), width * 0.64, height * 0.24, radius * 0.6);
            context.fill();
            context.beginPath();
            context.roundRect(x + (width * 0.24), y + (height * 0.48), width * 0.52, height * 0.22, radius * 0.45);
            context.fill();

            // Lights (red and blue)
            context.fillStyle = '#ff0000';
            context.beginPath();
            context.arc(x + (width * 0.3), y + (height * 0.1), width * 0.08, 0, Math.PI * 2);
            context.fill();

            context.fillStyle = '#0066ff';
            context.beginPath();
            context.arc(x + (width * 0.7), y + (height * 0.1), width * 0.08, 0, Math.PI * 2);
            context.fill();
        };

        const drawCarDamage = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, damageLevel: number) => {
            if (damageLevel === 0) return;

            context.strokeStyle = '#ff6b6b';
            context.lineWidth = Math.max(2, width * 0.05);
            context.globalAlpha = 0.6;

            if (damageLevel >= 1) {
                context.beginPath();
                context.moveTo(x + (width * 0.3), y + (height * 0.2));
                context.lineTo(x + (width * 0.5), y + (height * 0.4));
                context.lineTo(x + (width * 0.35), y + (height * 0.35));
                context.stroke();
            }

            if (damageLevel >= 2) {
                context.beginPath();
                context.moveTo(x + (width * 0.65), y + (height * 0.15));
                context.lineTo(x + (width * 0.75), y + (height * 0.35));
                context.lineTo(x + (width * 0.68), y + (height * 0.28));
                context.stroke();

                context.beginPath();
                context.moveTo(x + (width * 0.2), y + (height * 0.6));
                context.lineTo(x + (width * 0.4), y + (height * 0.75));
                context.lineTo(x + (width * 0.25), y + (width * 0.7));
                context.stroke();
            }

            context.globalAlpha = 1;
        };

        const drawHearts = (context: CanvasRenderingContext2D, width: number, lives: number) => {
            const heartSize = 24;
            const startX = width - (heartSize * 3.5) - 12;
            const startY = 16;

            for (let i = 0; i < 3; i += 1) {
                const x = startX + (i * (heartSize + 8));
                context.fillStyle = i < lives ? '#ff4444' : '#888888';
                context.globalAlpha = i < lives ? 1 : 0.3;

                context.beginPath();
                context.moveTo(x, startY + (heartSize * 0.3));
                context.bezierCurveTo(x, startY, x - (heartSize * 0.4), startY, x - (heartSize * 0.4), startY + (heartSize * 0.2));
                context.bezierCurveTo(x - (heartSize * 0.4), startY + (heartSize * 0.4), x - (heartSize * 0.1), startY + (heartSize * 0.5), x, startY + (heartSize * 0.75));
                context.bezierCurveTo(x + (heartSize * 0.1), startY + (heartSize * 0.5), x + (heartSize * 0.4), startY + (heartSize * 0.4), x + (heartSize * 0.4), startY + (heartSize * 0.2));
                context.bezierCurveTo(x + (heartSize * 0.4), startY, x, startY, x, startY + (heartSize * 0.3));
                context.fill();
            }

            context.globalAlpha = 1;
        };

        const drawLegoBrick = (
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number,
            time: number
        ) => {
            const brickColor = '#ffd600';
            const brickDark = '#c8a600';
            const studRadius = width * 0.17;
            const studTop = height * 0.14;
            const bodyY = y + studTop;
            const bodyH = height - studTop;
            const radius = width * 0.12;
            const pulse = 0.9 + Math.sin(time * 0.006) * 0.1;

            // Shadow
            context.fillStyle = 'rgba(0, 0, 0, 0.18)';
            context.beginPath();
            context.ellipse(x + width / 2, y + height + 4, width * 0.42, height * 0.11, 0, 0, Math.PI * 2);
            context.fill();

            // Glow
            context.save();
            context.globalAlpha = 0.22 * pulse;
            context.fillStyle = '#fff176';
            context.beginPath();
            context.ellipse(x + width / 2, y + height / 2, width * 0.85, height * 0.75, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();

            // Brick body
            context.fillStyle = brickColor;
            context.beginPath();
            context.roundRect(x, bodyY, width, bodyH, radius);
            context.fill();
            context.strokeStyle = brickDark;
            context.lineWidth = 1.5;
            context.beginPath();
            context.roundRect(x, bodyY, width, bodyH, radius);
            context.stroke();

            // Studs (2x1)
            const studCentres = [x + width * 0.3, x + width * 0.7];
            for (const sx of studCentres) {
                context.fillStyle = brickColor;
                context.beginPath();
                context.ellipse(sx, bodyY, studRadius, studRadius * 0.48, 0, 0, Math.PI * 2);
                context.fill();
                context.strokeStyle = brickDark;
                context.lineWidth = 1;
                context.beginPath();
                context.ellipse(sx, bodyY, studRadius, studRadius * 0.48, 0, 0, Math.PI * 2);
                context.stroke();
            }

            // Highlight
            context.fillStyle = 'rgba(255, 255, 255, 0.28)';
            context.fillRect(x + width * 0.1, bodyY + bodyH * 0.1, width * 0.14, bodyH * 0.55);
        };

        const playBrickPickupSound = () => {
            if (!sfxOnRef.current) return;
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) return;
                if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
                const audioContext = audioContextRef.current;
                if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);

                const now = audioContext.currentTime;
                const gain = audioContext.createGain();
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
                gain.connect(audioContext.destination);

                [660, 880, 1100].forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + i * 0.05);
                    osc.connect(gain);
                    osc.start(now + i * 0.05);
                    osc.stop(now + i * 0.05 + 0.14);
                });
            } catch { /* ignore */ }
        };

        const playCakePickupSound = () => {
            if (!sfxOnRef.current) return;
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) return;
                if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
                const audioContext = audioContextRef.current;
                if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);

                const now = audioContext.currentTime;
                const gain = audioContext.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
                gain.connect(audioContext.destination);

                // Cheerful little heart-restore jingle.
                [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + i * 0.06);
                    osc.connect(gain);
                    osc.start(now + i * 0.06);
                    osc.stop(now + i * 0.06 + 0.18);
                });
            } catch { /* ignore */ }
        };

        const drawCake = (
            ctx: CanvasRenderingContext2D,
            x: number,
            y: number,
            w: number,
            h: number,
            time: number,
        ) => {
            // Gentle bobbing so it's easy to spot.
            const bob = Math.sin(time / 280) * h * 0.04;
            const cx = x + w / 2;
            const baseY = y + h * 0.95 + bob;
            const plateW = w * 1.1;
            const cakeW = w * 0.9;
            const cakeH = h * 0.45;
            const frostingH = h * 0.18;
            const candleH = h * 0.22;

            // Plate
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(cx, baseY, plateW / 2, h * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = Math.max(1, w * 0.02);
            ctx.stroke();

            // Cake body (pink)
            const bodyTop = baseY - cakeH;
            ctx.fillStyle = '#ff80ab';
            ctx.fillRect(cx - cakeW / 2, bodyTop, cakeW, cakeH);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.strokeRect(cx - cakeW / 2, bodyTop, cakeW, cakeH);

            // Cream stripe
            ctx.fillStyle = '#fff1f4';
            ctx.fillRect(cx - cakeW / 2, bodyTop + cakeH * 0.55, cakeW, cakeH * 0.18);

            // Frosting drips on top
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cx - cakeW / 2, bodyTop);
            const drips = 4;
            for (let i = 0; i <= drips; i += 1) {
                const t = i / drips;
                const px = cx - cakeW / 2 + cakeW * t;
                const py = bodyTop + (i % 2 === 0 ? frostingH * 0.4 : -frostingH * 0.1);
                ctx.lineTo(px, py);
            }
            ctx.lineTo(cx + cakeW / 2, bodyTop);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.stroke();

            // Candle
            const candleX = cx - w * 0.04;
            const candleY = bodyTop - candleH;
            ctx.fillStyle = '#42a5f5';
            ctx.fillRect(candleX, candleY, w * 0.08, candleH);

            // Flame (flickering)
            const flameFlicker = 1 + Math.sin(time / 90) * 0.12;
            ctx.fillStyle = '#ffb300';
            ctx.beginPath();
            ctx.ellipse(cx, candleY - h * 0.04 * flameFlicker, w * 0.05, h * 0.06 * flameFlicker, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff59d';
            ctx.beginPath();
            ctx.ellipse(cx, candleY - h * 0.045 * flameFlicker, w * 0.025, h * 0.035 * flameFlicker, 0, 0, Math.PI * 2);
            ctx.fill();

            // Little red heart on the front to hint at the heal effect
            const heartCx = cx;
            const heartCy = bodyTop + cakeH * 0.3;
            const heartSize = w * 0.18;
            ctx.fillStyle = '#e53935';
            ctx.beginPath();
            ctx.moveTo(heartCx, heartCy + heartSize * 0.35);
            ctx.bezierCurveTo(heartCx + heartSize * 0.6, heartCy - heartSize * 0.2,
                heartCx + heartSize * 0.2, heartCy - heartSize * 0.55,
                heartCx, heartCy - heartSize * 0.15);
            ctx.bezierCurveTo(heartCx - heartSize * 0.2, heartCy - heartSize * 0.55,
                heartCx - heartSize * 0.6, heartCy - heartSize * 0.2,
                heartCx, heartCy + heartSize * 0.35);
            ctx.fill();
        };

        const playStreakSound = () => {
            if (!sfxOnRef.current) return;
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) return;
                if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
                const audioContext = audioContextRef.current;
                if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);

                const now = audioContext.currentTime;
                const gain = audioContext.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
                gain.connect(audioContext.destination);

                // Bright triumphant rising arpeggio.
                [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + i * 0.07);
                    osc.connect(gain);
                    osc.start(now + i * 0.07);
                    osc.stop(now + i * 0.07 + 0.18);
                });
            } catch { /* ignore */ }
        };

        const drawShieldPowerUp = (
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number
        ) => {
            const centerX = x + (width / 2);
            const centerY = y + (height / 2);
            const radius = Math.min(width, height) * 0.48;

            const orbGradient = context.createRadialGradient(centerX, centerY - (radius * 0.2), radius * 0.2, centerX, centerY, radius);
            orbGradient.addColorStop(0, '#ffffff');
            orbGradient.addColorStop(0.45, '#80deea');
            orbGradient.addColorStop(1, '#0288d1');

            context.fillStyle = 'rgba(0, 0, 0, 0.18)';
            context.beginPath();
            context.ellipse(centerX, y + height + 4, width * 0.36, height * 0.12, 0, 0, Math.PI * 2);
            context.fill();

            context.fillStyle = orbGradient;
            context.beginPath();
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.fill();

            context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            context.lineWidth = Math.max(2, radius * 0.16);
            context.beginPath();
            context.arc(centerX, centerY, radius * 0.72, Math.PI * 0.2, Math.PI * 0.8);
            context.stroke();

            context.beginPath();
            context.moveTo(centerX, centerY - (radius * 0.78));
            context.lineTo(centerX, centerY + (radius * 0.52));
            context.stroke();
        };

        const playCrashSound = () => {
            if (!sfxOnRef.current) return;
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) {
                    return;
                }

                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContextCtor();
                }

                const audioContext = audioContextRef.current;
                if (audioContext.state === 'suspended') {
                    void audioContext.resume().catch(() => undefined);
                }

                const now = audioContext.currentTime;
                const masterGain = audioContext.createGain();
                masterGain.gain.setValueAtTime(0.0001, now);
                masterGain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
                masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
                masterGain.connect(audioContext.destination);

                const tone = audioContext.createOscillator();
                tone.type = 'square';
                tone.frequency.setValueAtTime(180, now);
                tone.frequency.exponentialRampToValueAtTime(52, now + 0.26);
                tone.connect(masterGain);
                tone.start(now);
                tone.stop(now + 0.28);

                const clack = audioContext.createOscillator();
                const clackGain = audioContext.createGain();
                clack.type = 'triangle';
                clack.frequency.setValueAtTime(720, now);
                clack.frequency.exponentialRampToValueAtTime(180, now + 0.08);
                clackGain.gain.setValueAtTime(0.18, now);
                clackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
                clack.connect(clackGain);
                clackGain.connect(masterGain);
                clack.start(now);
                clack.stop(now + 0.14);
            } catch {
                return;
            }
        };

        const playShieldPickupSound = () => {
            if (!sfxOnRef.current) return;
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) {
                    return;
                }

                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContextCtor();
                }

                const audioContext = audioContextRef.current;
                if (audioContext.state === 'suspended') {
                    void audioContext.resume().catch(() => undefined);
                }

                const now = audioContext.currentTime;
                const gain = audioContext.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
                gain.connect(audioContext.destination);

                const ping = audioContext.createOscillator();
                ping.type = 'sine';
                ping.frequency.setValueAtTime(620, now);
                ping.frequency.exponentialRampToValueAtTime(980, now + 0.18);
                ping.connect(gain);
                ping.start(now);
                ping.stop(now + 0.22);

                const sparkle = audioContext.createOscillator();
                const sparkleGain = audioContext.createGain();
                sparkle.type = 'triangle';
                sparkle.frequency.setValueAtTime(900, now + 0.03);
                sparkle.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
                sparkleGain.gain.setValueAtTime(0.14, now + 0.03);
                sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
                sparkle.connect(sparkleGain);
                sparkleGain.connect(audioContext.destination);
                sparkle.start(now + 0.03);
                sparkle.stop(now + 0.22);
            } catch {
                return;
            }
        };

        const playShieldWearOffSound = () => {
            if (!sfxOnRef.current) return;
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) {
                    return;
                }

                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContextCtor();
                }

                const audioContext = audioContextRef.current;
                if (audioContext.state === 'suspended') {
                    void audioContext.resume().catch(() => undefined);
                }

                const now = audioContext.currentTime;
                const gain = audioContext.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
                gain.connect(audioContext.destination);

                const fadeTone = audioContext.createOscillator();
                fadeTone.type = 'sine';
                fadeTone.frequency.setValueAtTime(520, now);
                fadeTone.frequency.exponentialRampToValueAtTime(180, now + 0.28);
                fadeTone.connect(gain);
                fadeTone.start(now);
                fadeTone.stop(now + 0.32);
            } catch {
                return;
            }
        };

        const createCrashPieces = (centerX: number, centerY: number, scale: number): ExplosionPiece[] => {
            const colors = ['#ffcf00', '#f57c00', '#d32f2f', '#ffffff'];

            return Array.from({ length: 16 }, (_, index) => {
                const angle = ((Math.PI * 2) / 16) * index + ((Math.random() - 0.5) * 0.28);
                const speed = (90 + (Math.random() * 180)) * scale;
                const width = (12 + (Math.random() * 20)) * scale;
                const height = (10 + (Math.random() * 18)) * scale;

                return {
                    x: centerX + ((Math.random() - 0.5) * 22 * scale),
                    y: centerY + ((Math.random() - 0.5) * 18 * scale),
                    width,
                    height,
                    velocityX: Math.cos(angle) * speed,
                    velocityY: Math.sin(angle) * speed - (50 * scale),
                    rotation: Math.random() * Math.PI,
                    spin: (Math.random() - 0.5) * 7,
                    color: colors[index % colors.length],
                    studs: width > height ? 2 : 1,
                };
            });
        };

        const drawCrashExplosion = (context: CanvasRenderingContext2D, time: number) => {
            if (crashTimeRef.current === null || crashCenterRef.current === null) {
                return;
            }

            const elapsedMs = time - crashTimeRef.current;
            if (elapsedMs > 900) {
                return;
            }

            const elapsedSec = elapsedMs / 1000;
            const fade = Math.max(0, 1 - (elapsedMs / 900));
            const { x: centerX, y: centerY } = crashCenterRef.current;

            const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, 120);
            glow.addColorStop(0, `rgba(255, 245, 157, ${0.8 * fade})`);
            glow.addColorStop(0.4, `rgba(255, 152, 0, ${0.45 * fade})`);
            glow.addColorStop(1, 'rgba(255, 152, 0, 0)');
            context.fillStyle = glow;
            context.beginPath();
            context.arc(centerX, centerY, 120 * Math.min(1.15, 0.35 + (elapsedSec * 2.2)), 0, Math.PI * 2);
            context.fill();

            context.strokeStyle = `rgba(255, 255, 255, ${0.4 * fade})`;
            context.lineWidth = 6 * fade;
            context.beginPath();
            context.arc(centerX, centerY, 24 + (elapsedSec * 160), 0, Math.PI * 2);
            context.stroke();

            crashPiecesRef.current.forEach((piece) => {
                const pieceX = piece.x + (piece.velocityX * elapsedSec);
                const pieceY = piece.y + (piece.velocityY * elapsedSec) + (elapsedSec * elapsedSec * 220);
                const rotation = piece.rotation + (piece.spin * elapsedSec);

                context.save();
                context.translate(pieceX, pieceY);
                context.rotate(rotation);
                context.globalAlpha = fade;
                context.fillStyle = piece.color;
                context.fillRect(-(piece.width / 2), -(piece.height / 2), piece.width, piece.height);

                context.fillStyle = 'rgba(255, 255, 255, 0.25)';
                context.fillRect(-(piece.width / 2), -(piece.height / 2), piece.width, Math.max(2, piece.height * 0.18));

                context.fillStyle = 'rgba(0, 0, 0, 0.18)';
                context.fillRect(-(piece.width / 2), (piece.height / 2) - Math.max(2, piece.height * 0.16), piece.width, Math.max(2, piece.height * 0.16));

                context.fillStyle = '#f5f5f5';
                const studSpacing = piece.width / (piece.studs + 1);
                for (let studIndex = 0; studIndex < piece.studs; studIndex += 1) {
                    const studX = -(piece.width / 2) + (studSpacing * (studIndex + 1));
                    context.beginPath();
                    context.arc(studX, -(piece.height * 0.18), Math.max(2, Math.min(piece.width, piece.height) * 0.14), 0, Math.PI * 2);
                    context.fill();
                }
                context.restore();
            });
        };

        const addSkidMark = (playerX: number, playerY: number, width: number) => {
            if (Math.random() < 0.6) {
                skidMarksRef.current.push({
                    x: playerX,
                    y: playerY,
                    distance: worldDistanceRef.current,
                    width: width * (0.4 + Math.random() * 0.6),
                    alpha: 0.5 + Math.random() * 0.3,
                    age: 0,
                });
            }
        };

        const drawSkidMarks = (context: CanvasRenderingContext2D, horizonY: number, roadBottomY: number) => {
            const projectY = (z: number) => horizonY + ((roadBottomY - horizonY) * Math.pow(z, 1.12));

            const marks = skidMarksRef.current;
            const worldDist = worldDistanceRef.current;
            context.fillStyle = '#333333';
            let writeIndex = 0;
            for (let i = 0; i < marks.length; i += 1) {
                const mark = marks[i];
                mark.age += 16;
                if (mark.age >= 3000) continue;
                marks[writeIndex++] = mark;

                const relativeDistance = mark.distance - worldDist;
                if (relativeDistance > 1020 || relativeDistance < -100) continue;

                const markY = projectY(relativeDistance);
                const fade = 1 - (mark.age / 3000);
                context.globalAlpha = mark.alpha * fade * 0.4;
                context.fillRect(mark.x - (mark.width / 2), markY - 2, mark.width, 4);
            }
            marks.length = writeIndex;

            context.globalAlpha = 1;
        };

        const updateWeather = () => {
            const scoreTier = Math.floor(scoreRef.current / 1000);
            if (scoreTier !== lastWeatherScoreRef.current) {
                lastWeatherScoreRef.current = scoreTier;
                let weatherOptions: Array<'clear' | 'rain' | 'fog'> = ['clear', 'rain', 'fog'];
                
                // Prevent the same weather from appearing 3 times in a row
                if (weatherHistoryRef.current.length >= 2) {
                    const lastTwo = weatherHistoryRef.current.slice(-2);
                    if (lastTwo[0] === lastTwo[1]) {
                        // Remove the weather that appeared twice to prevent it appearing thrice
                        weatherOptions = weatherOptions.filter((w) => w !== lastTwo[0]);
                    }
                }
                
                const newWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
                weatherTypeRef.current = newWeather;
                weatherHistoryRef.current.push(newWeather);
                if (weatherHistoryRef.current.length > 2) {
                    weatherHistoryRef.current.shift();
                }
                
                lightingIntensityRef.current = weatherTypeRef.current === 'fog' ? 0.7 : weatherTypeRef.current === 'rain' ? 0.8 : 1;

                if (newWeather === 'rain') {
                    startRainSound();
                } else {
                    stopRainSound();
                }
            }
        };

        const startRainSound = () => {
            if (!sfxOnRef.current) return;
            if (rainSourceRef.current) return; // already playing
            try {
                const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AudioContextCtor) return;
                if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

                // Generate ~2s of looping white noise.
                const bufferSize = Math.floor(ctx.sampleRate * 2);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i += 1) {
                    data[i] = Math.random() * 2 - 1;
                }

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;

                // Bandpass to give it that rainy hiss rather than harsh white noise.
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1200;
                filter.Q.value = 0.6;

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.5);

                source.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                source.start();

                rainSourceRef.current = source;
                rainGainRef.current = gain;
            } catch { /* ignore */ }
        };

        const stopRainSound = () => {
            const source = rainSourceRef.current;
            const gain = rainGainRef.current;
            const ctx = audioContextRef.current;
            if (gain && ctx) {
                try {
                    gain.gain.cancelScheduledValues(ctx.currentTime);
                    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
                } catch { /* ignore */ }
            }
            if (source) {
                try { source.stop(ctx ? ctx.currentTime + 0.6 : 0); } catch { /* ignore */ }
            }
            rainSourceRef.current = null;
            rainGainRef.current = null;
        };

        const drawWeatherEffects = (context: CanvasRenderingContext2D, width: number, height: number) => {
            const weather = weatherTypeRef.current;
            if (weather === 'clear') return;
            if (weather === 'rain') {
                // Reduced from 140 to 60 strokes; batched into a single path for one stroke() call.
                context.globalAlpha = 0.3;
                context.strokeStyle = '#2196f3';
                context.lineWidth = 2.5;
                const scroll = roadScrollRef.current * 200;
                const distOffset = worldDistanceRef.current * 0.5;
                context.beginPath();
                for (let i = 0; i < 60; i += 1) {
                    const rainX = (i * 70 + scroll) % width;
                    const rainY = ((i * 11.7 + distOffset) % height);
                    context.moveTo(rainX, rainY);
                    context.lineTo(rainX - 25, rainY + 35);
                }
                context.stroke();
                context.globalAlpha = 1;
            } else if (weather === 'fog') {
                if (!fogGradientRef.current || cachedGradientHeightRef.current !== height) {
                    const fogGradient = context.createLinearGradient(0, 0, 0, height);
                    fogGradient.addColorStop(0, 'rgba(200, 200, 200, 0.35)');
                    fogGradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.25)');
                    fogGradient.addColorStop(1, 'rgba(200, 200, 200, 0.35)');
                    fogGradientRef.current = fogGradient;
                }
                context.fillStyle = fogGradientRef.current;
                context.fillRect(0, 0, width, height);
            }
        };

        const spawnConfetti = (canvasWidth: number, canvasHeight: number, time: number) => {
            const colors = ['#ffcf00', '#d32f2f', '#1565c0', '#2e7d32', '#6a1b9a', '#ef6c00', '#ffffff', '#f8bbd0'];
            // Cap total live confetti so achievement bursts never balloon the loop.
            const maxLive = 80;
            const remainingSlots = Math.max(0, maxLive - confettiRef.current.length);
            const spawnCount = Math.min(40, remainingSlots);
            for (let i = 0; i < spawnCount; i++) {
                const side = Math.floor(Math.random() * 4);
                let x: number, y: number, vx: number, vy: number;
                if (side === 0) { // top
                    x = Math.random() * canvasWidth; y = -8;
                    vx = (Math.random() - 0.5) * 5; vy = 2 + Math.random() * 5;
                } else if (side === 1) { // left
                    x = -8; y = Math.random() * canvasHeight * 0.6;
                    vx = 2 + Math.random() * 4; vy = (Math.random() - 0.5) * 4 + 1;
                } else if (side === 2) { // right
                    x = canvasWidth + 8; y = Math.random() * canvasHeight * 0.6;
                    vx = -(2 + Math.random() * 4); vy = (Math.random() - 0.5) * 4 + 1;
                } else { // bottom edge fallback
                    x = Math.random() * canvasWidth; y = canvasHeight * 0.5;
                    vx = (Math.random() - 0.5) * 6; vy = -(3 + Math.random() * 5);
                }
                confettiRef.current.push({
                    x, y, vx, vy,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    w: 5 + Math.random() * 7,
                    h: 3 + Math.random() * 5,
                    rotation: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 0.25,
                    startTime: time,
                });
            }
        };

        const checkAchievements = (time: number) => {
            const stats = gameStatsRef.current;
            let anyNew = false;
            for (const ach of ACHIEVEMENTS) {
                if (unlockedAchievementsRef.current.has(ach.id)) continue;
                const value = stats[ach.stat as keyof GameStats] ?? 0;
                if (value >= ach.target) {
                    unlockedAchievementsRef.current.add(ach.id);
                    anyNew = true;
                    pendingAchievementToastRef.current = { label: ach.label, emoji: ach.emoji, until: time + 3500 };
                    spawnConfetti(canvas.width, canvas.height, time);
                }
            }
            if (anyNew) {
                updateUi({ unlockedAchievements: new Set(unlockedAchievementsRef.current) });
                try {
                    window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify([...unlockedAchievementsRef.current]));
                } catch { /* ignore */ }
            }
        };

        const saveStats = () => {
            try {
                window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameStatsRef.current));
            } catch { /* ignore */ }
        };

        // Acquire the 2D context once with `alpha: false` for an opaque backing store —
        // measurably faster than per-frame getContext + transparent compositing.
        const cachedContext = canvas.getContext('2d', { alpha: false });

        // Cache the active skin object across frames; only re-resolve when selection changes.
        type CarSkinType = (typeof CAR_SKINS)[number];
        type MotoSkinType = (typeof MOTORCYCLE_SKINS)[number];
        let cachedCarSkinId: CarSkinId | null = null;
        let cachedCarSkin: CarSkinType = CAR_SKINS[0];
        let cachedMotoSkinId: MotorcycleSkinId | null = null;
        let cachedMotoSkin: MotoSkinType = MOTORCYCLE_SKINS[0];
        const getActiveCarSkin = () => {
            if (selectedSkinRef.current !== cachedCarSkinId) {
                cachedCarSkinId = selectedSkinRef.current;
                cachedCarSkin = CAR_SKINS.find((s) => s.id === cachedCarSkinId) ?? CAR_SKINS[0];
            }
            return cachedCarSkin;
        };
        const getActiveMotoSkin = () => {
            if (selectedMotorcycleSkinRef.current !== cachedMotoSkinId) {
                cachedMotoSkinId = selectedMotorcycleSkinRef.current;
                cachedMotoSkin = MOTORCYCLE_SKINS.find((s) => s.id === cachedMotoSkinId) ?? MOTORCYCLE_SKINS[0];
            }
            return cachedMotoSkin;
        };

        const draw = (time: number) => {
            const context = cachedContext;
            if (!context) {
                return;
            }

            if (lastFrameTimeRef.current === 0) {
                lastFrameTimeRef.current = time;
            }

            const deltaMs = Math.min(40, time - lastFrameTimeRef.current);
            const deltaSec = deltaMs / 1000;
            lastFrameTimeRef.current = time;

            const width = canvas.width;
            const height = canvas.height;
            const centerX = width * 0.5;
            const horizonY = height * 0.16;
            const roadBottomY = height * 0.95;
            const roadTopWidth = width * 0.19;
            const roadBottomWidth = width * 0.88;

            const projectY = (z: number) => horizonY + ((roadBottomY - horizonY) * Math.pow(z, 1.12));
            const projectRoadWidth = (z: number) => roadTopWidth + ((roadBottomWidth - roadTopWidth) * Math.pow(z, 1.05));
            const projectLaneCenter = (lane: number, z: number) => centerX + ((lane - 1) * (projectRoadWidth(z) / 3.1));
            const hasActiveShield = shieldUntilRef.current > time;

            if (shieldWasActiveLastFrameRef.current && !hasActiveShield) {
                playShieldWearOffSound();
            }

            const playerZ = 0.93;
            if (isGameStartedRef.current && !isGameOverRef.current && !isPausedRef.current) {
                displayedLaneRef.current += (laneIndexRef.current - displayedLaneRef.current) * Math.min(1, deltaSec * 11);
                updateWeather();
                
                worldDistanceRef.current += playerSpeedRef.current * deltaSec;
                roadScrollRef.current = (roadScrollRef.current + playerSpeedRef.current * 0.002 * deltaSec) % 1;
                playerSpeedRef.current = Math.min(760, playerSpeedRef.current + 10 * deltaSec);

                // Add skid marks when player is actively changing lanes
                if (Math.abs(laneIndexRef.current - displayedLaneRef.current) > 0.1) {
                    const playerCenterX = centerX + ((displayedLaneRef.current - 1) * (projectRoadWidth(playerZ) / 3.1));
                    const playerBottomY = projectY(playerZ);
                    const playerWidth = width * 0.085 * 1.06;
                    addSkidMark(playerCenterX, playerBottomY + 8, playerWidth);
                }

                // Difficulty tier: every 500 points ramps up car speed and tightens spawn delay.
                // Capped at tier 8 (score 4000+) so it stays playable.
                const difficultyTier = Math.min(8, Math.floor(scoreRef.current / 500));
                const carSpeedBonus = difficultyTier * 28;       // +28 per tier to base speed range
                const spawnDelayReduction = difficultyTier * 48; // -48 ms per tier off spawn delay

                // === Mini-boss: spawn a swerving "Bossmobile" every 3000 score. ===
                // Bosses are police-typed cars (3 damage) that swerve between lanes.
                if (!bossActiveRef.current && scoreRef.current >= nextBossScoreThresholdRef.current) {
                    const startLane: 0 | 1 | 2 = ([0, 1, 2] as const)[Math.floor(Math.random() * 3)];
                    trafficRef.current.push({
                        id: nextCarIdRef.current,
                        lane: startLane,
                        // Spawn just past the horizon for a long, dramatic approach.
                        distance: worldDistanceRef.current + 50,
                        // Slower than a regular police car so it's intimidating but readable.
                        speed: 230 + carSpeedBonus,
                        color: '#7e22ce',
                        type: 'police',
                        isBoss: true,
                        displayLane: startLane,
                        nextSwerveAt: time + 900 + Math.random() * 500,
                        // Boss only swerves twice, then locks lane for the final approach.
                        swervesLeft: 2,
                    });
                    nextCarIdRef.current += 1;
                    bossActiveRef.current = true;
                    nextBossScoreThresholdRef.current += 3000;
                    pendingAchievementToastRef.current = {
                        emoji: '🚨',
                        label: 'BOSSMOBILE INCOMING',
                        until: time + 2600,
                    };
                }

                if (time - lastSpawnTimeRef.current > nextSpawnDelayRef.current) {
                    const minLaneGap = 200;
                    const spawnStartOffset = 28;
                    const lanes: Array<0 | 1 | 2> = [0, 1, 2];
                    const eligibleLanes = lanes.filter((lane) => {
                        const nearestRelativeDistance = trafficRef.current
                            .filter((car) => car.lane === lane)
                            .map((car) => car.distance - worldDistanceRef.current)
                            .filter((relativeDistance) => relativeDistance > 0)
                            .reduce((minDistance, relativeDistance) => Math.min(minDistance, relativeDistance), Number.POSITIVE_INFINITY);

                        return nearestRelativeDistance === Number.POSITIVE_INFINITY || nearestRelativeDistance > minLaneGap;
                    });

                    let selectedLane: 0 | 1 | 2 | null = null;
                    if (eligibleLanes.length > 0) {
                        const lastLane = recentSpawnLanesRef.current[recentSpawnLanesRef.current.length - 1];
                        const weightedLanes = eligibleLanes.map((lane) => {
                            const recentCount = recentSpawnLanesRef.current.filter((recentLane) => recentLane === lane).length;
                            const nearbyLaneCount = trafficRef.current.filter((car) => {
                                if (car.lane !== lane) {
                                    return false;
                                }

                                const relativeDistance = car.distance - worldDistanceRef.current;
                                return relativeDistance > 0 && relativeDistance < 480;
                            }).length;

                            const streakPenalty = lastLane === lane ? 1.6 : 0;
                            const weight = 1 / (1 + (recentCount * 1.15) + streakPenalty + (nearbyLaneCount * 0.45));

                            return { lane, weight };
                        });

                        const totalWeight = weightedLanes.reduce((sum, laneWeight) => sum + laneWeight.weight, 0);
                        let roll = Math.random() * totalWeight;
                        for (const laneWeight of weightedLanes) {
                            roll -= laneWeight.weight;
                            if (roll <= 0) {
                                selectedLane = laneWeight.lane;
                                break;
                            }
                        }

                        if (selectedLane === null) {
                            selectedLane = weightedLanes[weightedLanes.length - 1].lane;
                        }
                    }

                    if (selectedLane !== null) {
                        const nextSpawnCount = spawnCountRef.current + 1;
                        const isShieldSpawn = nextSpawnCount >= nextShieldSpawnAtRef.current;
                        const isCakeSpawn = nextSpawnCount >= nextCakeSpawnAtRef.current && !isShieldSpawn;
                        const isPoliceCar = nextSpawnCount % 20 === 0 && !isShieldSpawn && !isCakeSpawn;
                        const isBrickSpawn = nextSpawnCount % 15 === 0 && !isShieldSpawn && !isCakeSpawn && !isPoliceCar;

                        // Cross-lane wall prevention: if both other lanes already have an
                        // upcoming car within ±220 of the natural spawn depth, push this
                        // car far enough ahead to avoid a 3-wide impassable wall.
                        // Hard cap so we never teleport a spawn into the middle of the
                        // visible road — anything past this stays comfortably near the horizon.
                        const crossLaneBuffer = 220;
                        const maxSpawnRelDist = 110; // ~relativeZ 0.12, still near horizon
                        let spawnRelDist = spawnStartOffset + (Math.random() * 28);
                        let skipSpawn = false;
                        const otherLanes = ([0, 1, 2] as const).filter((l) => l !== selectedLane);
                        const otherNearestAhead = otherLanes.map((l) =>
                            trafficRef.current
                                .filter((c) => c.lane === l)
                                .map((c) => c.distance - worldDistanceRef.current)
                                .filter((d) => d > 0 && d < 700)
                                .reduce((min, d) => Math.min(min, d), Number.POSITIVE_INFINITY)
                        );
                        const bothOthersNearSpawn = otherNearestAhead.every(
                            (d) => d !== Number.POSITIVE_INFINITY && Math.abs(d - spawnRelDist) < crossLaneBuffer
                        );
                        if (bothOthersNearSpawn) {
                            const maxOther = Math.max(...(otherNearestAhead.filter((d) => d !== Number.POSITIVE_INFINITY) as number[]));
                            const candidate = maxOther + crossLaneBuffer + 20 + Math.random() * 60;
                            if (candidate > maxSpawnRelDist) {
                                // No safe spot at the horizon right now. Skip this spawn
                                // attempt and try again very soon, instead of popping a
                                // car/pickup into the middle of the screen.
                                skipSpawn = true;
                                nextSpawnDelayRef.current = 120 + Math.random() * 120;
                                lastSpawnTimeRef.current = time;
                            } else {
                                spawnRelDist = candidate;
                            }
                        }

                        if (!skipSpawn) {

                        trafficRef.current.push({
                            id: nextCarIdRef.current,
                            lane: selectedLane,
                            distance: worldDistanceRef.current + spawnRelDist,
                            speed: isShieldSpawn ? 180 + Math.random() * 110 : isCakeSpawn ? 200 + Math.random() * 80 : isBrickSpawn ? 220 + Math.random() * 80 : isPoliceCar ? 320 + carSpeedBonus + Math.random() * 80 : 280 + carSpeedBonus + Math.random() * 90,
                            color: isShieldSpawn ? '#4dd0e1' : isCakeSpawn ? '#ff80ab' : isBrickSpawn ? '#ffd600' : isPoliceCar ? '#1e3a8a' : TRAFFIC_COLORS[nextCarIdRef.current % TRAFFIC_COLORS.length],
                            type: isShieldSpawn ? 'shield' : isCakeSpawn ? 'cake' : isBrickSpawn ? 'brick' : isPoliceCar ? 'police' : 'car',
                        });
                        nextCarIdRef.current += 1;
                        spawnCountRef.current = nextSpawnCount;
                        if (isShieldSpawn) {
                            nextShieldSpawnAtRef.current = nextSpawnCount + getShieldSpawnInterval(scoreRef.current);
                        }
                        if (isCakeSpawn) {
                            nextCakeSpawnAtRef.current = nextSpawnCount + getCakeSpawnInterval();
                        }
                        recentSpawnLanesRef.current.push(selectedLane);
                        if (recentSpawnLanesRef.current.length > 6) {
                            recentSpawnLanesRef.current.shift();
                        }
                        nextSpawnDelayRef.current = Math.max(280, 620 - spawnDelayReduction) + Math.random() * 260;
                        }
                    } else {
                        nextSpawnDelayRef.current = 180 + Math.random() * 120;
                    }

                    lastSpawnTimeRef.current = time;
                }

                // Mutate distances in place — no per-frame allocation of car objects.
                const playerSpeed = playerSpeedRef.current;
                const traffic = trafficRef.current;
                let bossStillActive = false;
                for (let i = 0; i < traffic.length; i += 1) {
                    traffic[i].distance += (playerSpeed + traffic[i].speed) * deltaSec;
                    // Boss-only swerve: pick a new lane every cooldown while it's still
                    // far from the player; lock lane once it nears the collision window
                    // so the swerve feels fair, not unreadable.
                    if (traffic[i].isBoss) {
                        bossStillActive = true;
                        const rel = traffic[i].distance - worldDistanceRef.current;
                        const dl = traffic[i].displayLane ?? traffic[i].lane;
                        // Ease the visual lane toward the snapped target lane.
                        traffic[i].displayLane = dl + (traffic[i].lane - dl) * Math.min(1, deltaSec * 5);
                        const swervesLeft = traffic[i].swervesLeft ?? 0;
                        if (swervesLeft > 0 && rel < 600 && time >= (traffic[i].nextSwerveAt ?? 0)) {
                            const current = traffic[i].lane;
                            // Boss can leap to ANY other lane — including hopping over the
                            // middle lane from 0 to 2 — for a wider, scarier swerve.
                            const candidates: Array<0 | 1 | 2> = ([0, 1, 2] as const).filter((l) => l !== current);
                            const next = candidates[Math.floor(Math.random() * candidates.length)];
                            traffic[i].lane = next;
                            traffic[i].swervesLeft = swervesLeft - 1;
                            traffic[i].nextSwerveAt = time + 850 + Math.random() * 500;
                        }
                    }
                }
                bossActiveRef.current = bossStillActive;

                const minCarGap = 110;
                const carsByLane: Record<0 | 1 | 2, TrafficCar[]> = { 0: [], 1: [], 2: [] };
                for (let i = 0; i < traffic.length; i += 1) {
                    carsByLane[traffic[i].lane].push(traffic[i]);
                }

                for (let lane = 0 as 0 | 1 | 2; lane <= 2; lane = (lane + 1) as 0 | 1 | 2) {
                    const laneCars = carsByLane[lane];
                    laneCars.sort((a, b) => b.distance - a.distance);
                    for (let index = 1; index < laneCars.length; index += 1) {
                        const maxTrailingDistance = laneCars[index - 1].distance - minCarGap;
                        if (laneCars[index].distance > maxTrailingDistance) {
                            laneCars[index].distance = maxTrailingDistance;
                        }
                    }
                    if (lane === 2) break;
                }

                // Cull off-screen cars in place; count overtakes simultaneously.
                let overtakeCount = 0;
                let writeIndex = 0;
                const worldDist = worldDistanceRef.current;
                for (let i = 0; i < traffic.length; i += 1) {
                    const car = traffic[i];
                    const relativeDistance = car.distance - worldDist;
                    if (relativeDistance < 1020) {
                        traffic[writeIndex++] = car;
                    } else if (car.type === 'car' || car.type === 'police') {
                        overtakeCount += 1;
                    }
                }
                traffic.length = writeIndex;

                if (overtakeCount > 0) {
                    streakRef.current += overtakeCount;
                    if (streakRef.current > gameStatsRef.current.highestStreak) {
                        gameStatsRef.current.highestStreak = streakRef.current;
                    }
                    // +50% per 10 overtakes in a row (10 -> 1.5x, 20 -> 2x, 30 -> 2.5x, ...)
                    const streakMultiplier = 1 + Math.floor(streakRef.current / 10) * 0.5;
                    scoreAccumulatorRef.current += overtakeCount * 35 * streakMultiplier;
                    gameStatsRef.current.totalOvertakes += overtakeCount;

                    // Fire a toast at every new 10-streak milestone reached this frame.
                    const milestone = Math.floor(streakRef.current / 10) * 10;
                    if (milestone >= 10 && milestone > lastStreakMilestoneRef.current) {
                        lastStreakMilestoneRef.current = milestone;
                        const toastMultiplier = 1 + Math.floor(milestone / 10) * 0.5;
                        pendingStreakToastRef.current = { streak: milestone, multiplier: toastMultiplier, until: time + 2200 };
                        playStreakSound();
                    }

                    checkAchievements(time);
                    saveStats();
                }

                const collisionObjects = trafficRef.current.filter((car) => {
                    // Boss collides on visual position (displayLane) since it's actively
                    // mid-swerve; player can't dodge a snap-only hitbox fairly.
                    if (car.isBoss) {
                        const dl = car.displayLane ?? car.lane;
                        if (Math.abs(dl - displayedLaneRef.current) > 0.5) {
                            return false;
                        }
                    } else if (car.lane !== laneIndexRef.current) {
                        return false;
                    }

                    const relativeDistance = car.distance - worldDistanceRef.current;
                    return relativeDistance > 740 && relativeDistance < 920;
                });

                if (collisionObjects.some((object) => object.type === 'shield')) {
                    shieldUntilRef.current = Math.max(shieldUntilRef.current, time + 5000);
                    playShieldPickupSound();
                    const collidedShieldIds = new Set(
                        collisionObjects.filter((object) => object.type === 'shield').map((object) => object.id)
                    );
                    trafficRef.current = trafficRef.current.filter((object) => !collidedShieldIds.has(object.id));
                }

                if (collisionObjects.some((object) => object.type === 'brick')) {
                    const earned = Math.floor(Math.random() * 3) + 1;
                    studsRef.current += earned;
                    updateUi({ studs: studsRef.current });
                    window.localStorage.setItem(STUDS_STORAGE_KEY, String(studsRef.current));
                    gameStatsRef.current.bricksCollected += 1;
                    gameStatsRef.current.totalStudsEarned += earned;
                    checkAchievements(time);
                    saveStats();
                    playBrickPickupSound();
                    const brickIds = new Set(
                        collisionObjects.filter((object) => object.type === 'brick').map((object) => object.id)
                    );
                    trafficRef.current = trafficRef.current.filter((object) => !brickIds.has(object.id));
                }

                if (collisionObjects.some((object) => object.type === 'cake')) {
                    // Reserve the next empty heart slot, accounting for any hearts already in flight.
                    const inFlightCount = flyingHeartsRef.current.filter((h) => !h.landed).length;
                    const projectedLives = playerLivesRef.current + inFlightCount;
                    if (projectedLives < 3) {
                        flyingHeartsRef.current.push({
                            startTime: time,
                            duration: 1400,
                            // Start near the player at the bottom of the canvas.
                            startX: width / 2,
                            startY: height - 50,
                            slotIndex: projectedLives,
                            landed: false,
                        });
                    }
                    playCakePickupSound();
                    const cakeIds = new Set(
                        collisionObjects.filter((object) => object.type === 'cake').map((object) => object.id)
                    );
                    trafficRef.current = trafficRef.current.filter((object) => !cakeIds.has(object.id));
                }

                const collidedCars = collisionObjects.filter((object) => object.type === 'car' || object.type === 'police');
                const collidedBoss = collidedCars.find((car) => car.isBoss);
                const isShielding = shieldUntilRef.current > time;
                // The Bossmobile bypasses shields entirely — dev mode is still immortal,
                // but a regular shield does NOT save the player from the boss.
                const isImmortal = (isShielding && !collidedBoss) || developerModeRef.current;

                if (collidedCars.length > 0 && isImmortal) {
                    const collidedCarIds = new Set(collidedCars.map((object) => object.id));
                    trafficRef.current = trafficRef.current.filter((object) => !collidedCarIds.has(object.id));
                    if (isShielding) {
                        // Bumping cars while shielded breaks the overtake streak —
                        // unless dev mode is on (godlike streak preservation).
                        if (!developerModeRef.current) {
                            streakRef.current = 0;
                            lastStreakMilestoneRef.current = 0;
                        }
                        const shieldKillCount = collidedCars.length;
                        const policeKillCount = collidedCars.filter((c) => c.type === 'police').length;
                        gameStatsRef.current.shieldKills += shieldKillCount;
                        gameStatsRef.current.policeKills += policeKillCount;
                        checkAchievements(time);
                        saveStats();
                        // Hitting a police car while shielded shatters the shield —
                        // player survives the hit but loses shield protection immediately.
                        if (policeKillCount > 0) {
                            shieldUntilRef.current = 0;
                            playShieldWearOffSound();
                        }
                    }
                }

                if (collidedCars.length > 0 && !isImmortal) {
                    // Any unshielded hit also breaks the streak.
                    streakRef.current = 0;
                    lastStreakMilestoneRef.current = 0;
                    // Damage rules:
                    //  - Bossmobile ignores shields. If the player WAS shielded when the boss
                    //    hit, the shield shatters and the boss deals 2 damage. With no shield
                    //    the boss deals 3 damage.
                    //  - Other police cars deal 3, regular cars deal 1.
                    const hasBossHit = !!collidedBoss;
                    const hasPoliceCar = collidedCars.some((car) => car.type === 'police');
                    let damageDealt: number;
                    if (hasBossHit) {
                        damageDealt = isShielding ? 2 : 3;
                        if (isShielding) {
                            shieldUntilRef.current = 0;
                            playShieldWearOffSound();
                        }
                    } else {
                        damageDealt = hasPoliceCar ? 3 : 1;
                    }
                    // Snapshot the player's lives BEFORE applying damage — used by the
                    // hidden Mobiles unlock condition below.
                    const livesBeforeHit = playerLivesRef.current;

                    // Take damage and lose lives
                    playerLivesRef.current -= damageDealt;
                    playerDamageRef.current = Math.min(2, playerDamageRef.current + 1);
                    runTookDamageRef.current = true;
                    
                    // Remove collided cars
                    const collidedCarIds = new Set(collidedCars.map((object) => object.id));
                    trafficRef.current = trafficRef.current.filter((object) => !collidedCarIds.has(object.id));
                    
                    playCrashSound();

                    // End game only if lives reach 0
                    if (playerLivesRef.current <= 0) {
                        if (crashTimeRef.current === null) {
                            const playerScale = 1.06;
                            const playerHeight = height * 0.19 * playerScale;
                            const playerCenterX = projectLaneCenter(displayedLaneRef.current, playerZ);
                            const playerBottomY = projectY(playerZ);
                            const crashCenterX = playerCenterX;
                            const crashCenterY = playerBottomY - (playerHeight * 0.52);
                            crashCenterRef.current = { x: crashCenterX, y: crashCenterY };
                            crashPiecesRef.current = createCrashPieces(crashCenterX, crashCenterY, Math.max(0.8, width / 900));
                            crashTimeRef.current = time;

                            const updatedLeaderboard = [...leaderboardRef.current, scoreRef.current]
                                .sort((a, b) => b - a)
                                .slice(0, 5);
                            leaderboardRef.current = updatedLeaderboard;
                            try {
                                window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(updatedLeaderboard));
                            } catch {
                                // Ignore storage failures so gameplay continues.
                            }
                        }

                        isGameOverRef.current = true;
                        bestScoreRef.current = Math.max(bestScoreRef.current, scoreRef.current);
                        updateUi({ isGameOver: true });

                        // === Hidden Mobiles unlock easter egg ===
                        // If this fatal hit was a police car AND the player was at full
                        // health when it landed, increment the streak. Two in a row
                        // unlocks the secret Mobiles shop tab. Any other death (or any
                        // non-full-health police death) resets the streak.
                        if (!mobilesUnlockedRef.current) {
                            if (hasPoliceCar && livesBeforeHit >= 3) {
                                policeFullHealthDeathsRef.current += 1;
                                if (policeFullHealthDeathsRef.current >= 2) {
                                    mobilesUnlockedRef.current = true;
                                    try { window.localStorage.setItem(MOBILES_UNLOCKED_STORAGE_KEY, '1'); } catch { /* ignore */ }
                                    updateUi({ mobilesUnlocked: true });
                                    pendingUnlockToastRef.current = {
                                        title: '🚙 MOBILES UNLOCKED!',
                                        subtitle: 'A new shop tab is available',
                                        until: time + 4000,
                                    };
                                }
                            } else {
                                policeFullHealthDeathsRef.current = 0;
                            }
                            try {
                                window.localStorage.setItem(
                                    POLICE_FULL_HEALTH_DEATHS_STORAGE_KEY,
                                    String(policeFullHealthDeathsRef.current)
                                );
                            } catch { /* ignore */ }
                        }
                        gameStatsRef.current.bestScore = Math.max(gameStatsRef.current.bestScore, scoreRef.current);
                        gameStatsRef.current.deaths += 1;
                        gameStatsRef.current.totalScore += scoreRef.current;
                        if (runStartTimeRef.current > 0) {
                            gameStatsRef.current.totalPlayMs += performance.now() - runStartTimeRef.current;
                            runStartTimeRef.current = 0;
                        }
                        if (!runTookDamageRef.current && scoreRef.current >= 200) {
                            gameStatsRef.current.cleanRuns += 1;
                        }
                        checkAchievements(time);
                        saveStats();
                        // Refresh the stats overlay snapshot so it shows the latest run.
                        setStatsSnapshot({ ...gameStatsRef.current });
                    }
                } else {
                    scoreAccumulatorRef.current += deltaMs * 0.028;
                    const nextScore = Math.floor(scoreAccumulatorRef.current);
                    if (nextScore !== scoreRef.current) {
                        scoreRef.current = nextScore;
                        if (nextScore > bestScoreRef.current) {
                            bestScoreRef.current = nextScore;
                            gameStatsRef.current.bestScore = nextScore;
                            checkAchievements(time);
                            saveStats();
                        }
                    }
                    const tierNow = Math.min(8, Math.floor(scoreRef.current / 500));
                    if (tierNow > gameStatsRef.current.maxTierReached) {
                        gameStatsRef.current.maxTierReached = tierNow;
                        checkAchievements(time);
                        saveStats();
                    }
                }
            }

            // Cache sky gradient per resize — avoids allocating a CanvasGradient every frame.
            if (!skyGradientRef.current || cachedGradientHeightRef.current !== height) {
                const skyGradient = context.createLinearGradient(0, 0, 0, height);
                skyGradient.addColorStop(0, '#8fc8f7');
                skyGradient.addColorStop(0.5, '#d8efff');
                skyGradient.addColorStop(1, '#f5f1e5');
                skyGradientRef.current = skyGradient;
                fogGradientRef.current = null;
                cachedGradientHeightRef.current = height;
            }
            context.fillStyle = skyGradientRef.current;
            context.fillRect(0, 0, width, height);

            // Apply dynamic lighting
            if (lightingIntensityRef.current < 1) {
                context.globalAlpha = 1 - lightingIntensityRef.current;
                context.fillStyle = '#333333';
                context.fillRect(0, 0, width, height);
                context.globalAlpha = 1;
            }

            context.fillStyle = '#dad4c8';
            context.fillRect(0, horizonY, width, height - horizonY);

            // === Sun + halo (high-left in the sky) ===
            const sunX = width * 0.18;
            const sunY = horizonY * 0.45;
            const sunR = Math.min(width, height) * 0.045;
            const sunGlow = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 5);
            sunGlow.addColorStop(0, 'rgba(255, 240, 180, 0.55)');
            sunGlow.addColorStop(0.4, 'rgba(255, 220, 140, 0.2)');
            sunGlow.addColorStop(1, 'rgba(255, 200, 120, 0)');
            context.fillStyle = sunGlow;
            context.fillRect(0, 0, width, horizonY * 1.3);
            context.fillStyle = '#fff8d6';
            context.beginPath();
            context.arc(sunX, sunY, sunR, 0, Math.PI * 2);
            context.fill();

            // === Slow drifting clouds (deterministic from time — no allocations beyond ellipse paths) ===
            for (let i = 0; i < 6; i += 1) {
                const baseY = horizonY * (0.18 + 0.13 * (i % 3));
                const speed = 0.008 + (i % 3) * 0.0035;
                const cx = ((time * speed + i * 230) % (width + 240)) - 120;
                const cw = width * 0.07 + (i % 3) * width * 0.018;
                const ch = cw * 0.42;
                context.fillStyle = `rgba(255,255,255,${0.78 - (i % 3) * 0.1})`;
                context.beginPath();
                context.ellipse(cx, baseY, cw, ch, 0, 0, Math.PI * 2);
                context.ellipse(cx + cw * 0.55, baseY + ch * 0.25, cw * 0.7, ch * 0.85, 0, 0, Math.PI * 2);
                context.ellipse(cx - cw * 0.55, baseY + ch * 0.25, cw * 0.6, ch * 0.75, 0, 0, Math.PI * 2);
                context.fill();
            }

            // === Distant mountain layers (silhouette ridges rising above horizon) ===
            const drawRidge = (color: string, peakHeight: number, count: number, jitter: number) => {
                context.fillStyle = color;
                context.beginPath();
                context.moveTo(0, horizonY + 4);
                for (let i = 0; i <= count; i += 1) {
                    const x = (width * i) / count;
                    const wave = 0.45 + 0.55 * Math.abs(Math.sin(i * 1.27 + jitter));
                    const y = horizonY - peakHeight * wave;
                    context.lineTo(x, y);
                }
                context.lineTo(width, horizonY + 4);
                context.closePath();
                context.fill();
            };
            drawRidge('#9aa6b0', height * 0.085, 7, 0.0);   // far
            drawRidge('#7d8b97', height * 0.060, 9, 1.7);   // mid
            drawRidge('#5e6b76', height * 0.038, 11, 3.4);  // near
            // Snow caps on the far ridge.
            context.fillStyle = 'rgba(255,255,255,0.85)';
            for (let i = 0; i < 5; i += 1) {
                const px = width * (0.12 + i * 0.2);
                const ph = height * 0.085 * (0.7 + 0.3 * Math.sin(i * 1.27));
                context.beginPath();
                context.moveTo(px, horizonY - ph);
                context.lineTo(px - 7, horizonY - ph * 0.55);
                context.lineTo(px + 7, horizonY - ph * 0.55);
                context.closePath();
                context.fill();
            }

            // === Tiny silhouette tree band along the horizon line ===
            context.fillStyle = '#3f5a3a';
            for (let i = 0; i < 26; i += 1) {
                const tx = (i * width) / 25;
                const th = 6 + (i % 4) * 3;
                context.beginPath();
                context.moveTo(tx, horizonY + 6);
                context.lineTo(tx - 4, horizonY + 6 - th * 0.3);
                context.lineTo(tx, horizonY + 6 - th);
                context.lineTo(tx + 4, horizonY + 6 - th * 0.3);
                context.closePath();
                context.fill();
            }

            const shoulderTopWidth = roadTopWidth * 1.34;
            const shoulderBottomWidth = roadBottomWidth * 1.07;

            context.fillStyle = '#bcb5aa';
            context.beginPath();
            context.moveTo(centerX - (shoulderTopWidth / 2), horizonY);
            context.lineTo(centerX + (shoulderTopWidth / 2), horizonY);
            context.lineTo(centerX + (shoulderBottomWidth / 2), roadBottomY);
            context.lineTo(centerX - (shoulderBottomWidth / 2), roadBottomY);
            context.closePath();
            context.fill();

            context.fillStyle = '#3b4048';
            context.beginPath();
            context.moveTo(centerX - (roadTopWidth / 2), horizonY);
            context.lineTo(centerX + (roadTopWidth / 2), horizonY);
            context.lineTo(centerX + (roadBottomWidth / 2), roadBottomY);
            context.lineTo(centerX - (roadBottomWidth / 2), roadBottomY);
            context.closePath();
            context.fill();

            const leftRoadTop = centerX - (roadTopWidth / 2);
            const leftRoadBottom = centerX - (roadBottomWidth / 2);
            const rightRoadTop = centerX + (roadTopWidth / 2);
            const rightRoadBottom = centerX + (roadBottomWidth / 2);

            context.strokeStyle = '#ffd54f';
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(leftRoadTop + 2, horizonY);
            context.lineTo(leftRoadBottom + 10, roadBottomY);
            context.stroke();
            context.beginPath();
            context.moveTo(rightRoadTop - 2, horizonY);
            context.lineTo(rightRoadBottom - 10, roadBottomY);
            context.stroke();

            for (let lane = 0; lane < 3; lane += 1) {
                const bandColor = lane === 1 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
                context.fillStyle = bandColor;
                context.beginPath();
                context.moveTo(projectLaneCenter(lane - 0.5, 0) - (roadTopWidth / 6.5), horizonY);
                context.lineTo(projectLaneCenter(lane + 0.5, 0) - (roadTopWidth / 6.5), horizonY);
                context.lineTo(projectLaneCenter(lane + 0.5, 1) - (roadBottomWidth / 6.5), roadBottomY);
                context.lineTo(projectLaneCenter(lane - 0.5, 1) - (roadBottomWidth / 6.5), roadBottomY);
                context.closePath();
                context.fill();
            }

            context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            context.lineWidth = 1;
            for (let i = 0; i < 8; i += 1) {
                const z = 0.18 + ((((i / 8) + roadScrollRef.current) % 1) * 0.76);
                const y = projectY(z);
                const roadWidth = projectRoadWidth(z);
                context.beginPath();
                context.moveTo(centerX - (roadWidth / 2), y);
                context.lineTo(centerX + (roadWidth / 2), y);
                context.stroke();
            }

            drawSkidMarks(context, horizonY, roadBottomY);

            // === Parallax roadside trees — pine + round trees flowing past the camera ===
            // Tree slots are evenly spaced in z and shifted by roadScroll for genuine flow.
            const TREE_SLOTS = 8;
            type TreeDraw = { x: number; baseY: number; size: number; kind: number; side: number; z: number };
            const treeDraws: TreeDraw[] = [];
            for (let side = -1 as -1 | 1; side <= 1; side += 2) {
                for (let i = 0; i < TREE_SLOTS; i += 1) {
                    const baseT = ((i / TREE_SLOTS) + roadScrollRef.current * 0.6) % 1;
                    const z = 0.05 + Math.pow(baseT, 1.15) * 0.95;
                    if (z < 0.05 || z > 1.05) continue;
                    const treeBaseY = projectY(z);
                    const roadW = projectRoadWidth(z);
                    const shoulderW = roadW * 1.34;
                    // Position trees just outside the shoulder edge.
                    const offsetFactor = 0.55 + (i * 13 % 5) * 0.08;
                    const tx = centerX + side * (shoulderW / 2 + roadW * 0.05 + roadW * offsetFactor * 0.15);
                    // Skip trees that have drifted off the canvas edges.
                    if (tx < -40 || tx > width + 40) continue;
                    const size = (height * 0.22) * Math.pow(z, 1.05);
                    const kind = (i + (side === -1 ? 0 : 3)) % 3; // 0,1: pine variants; 2: round
                    treeDraws.push({ x: tx, baseY: treeBaseY, size, kind, side, z });
                }
            }
            // Far-to-near so closer trees draw on top.
            treeDraws.sort((a, b) => a.z - b.z);
            for (let i = 0; i < treeDraws.length; i += 1) {
                const t = treeDraws[i];
                const trunkW = Math.max(2, t.size * 0.07);
                const trunkH = t.size * 0.22;
                // Drop shadow on the dirt.
                context.fillStyle = 'rgba(0,0,0,0.22)';
                context.beginPath();
                context.ellipse(t.x, t.baseY + 1, t.size * 0.36, t.size * 0.06, 0, 0, Math.PI * 2);
                context.fill();
                // Trunk.
                context.fillStyle = '#5d3b22';
                context.fillRect(t.x - trunkW / 2, t.baseY - trunkH, trunkW, trunkH);
                if (t.kind === 2) {
                    // Round broadleaf tree: 3 stacked green blobs.
                    context.fillStyle = '#3f7d3a';
                    context.beginPath();
                    context.arc(t.x, t.baseY - trunkH - t.size * 0.32, t.size * 0.4, 0, Math.PI * 2);
                    context.fill();
                    context.fillStyle = '#52a04c';
                    context.beginPath();
                    context.arc(t.x - t.size * 0.16, t.baseY - trunkH - t.size * 0.42, t.size * 0.28, 0, Math.PI * 2);
                    context.arc(t.x + t.size * 0.18, t.baseY - trunkH - t.size * 0.46, t.size * 0.3, 0, Math.PI * 2);
                    context.fill();
                    // Highlight
                    context.fillStyle = 'rgba(220,255,210,0.35)';
                    context.beginPath();
                    context.arc(t.x - t.size * 0.1, t.baseY - trunkH - t.size * 0.5, t.size * 0.12, 0, Math.PI * 2);
                    context.fill();
                } else {
                    // Pine tree: stacked triangles.
                    const layers = 3;
                    const baseShade = t.kind === 0 ? '#2f6b3a' : '#274d2f';
                    const liteShade = t.kind === 0 ? '#3f8e4a' : '#3a6f3f';
                    const topY = t.baseY - trunkH - t.size * 0.95;
                    for (let l = 0; l < layers; l += 1) {
                        const layerTop = topY + (l * t.size * 0.28);
                        const layerHalfW = t.size * (0.22 + l * 0.1);
                        const layerBottom = layerTop + t.size * 0.45;
                        context.fillStyle = l === 0 ? liteShade : baseShade;
                        context.beginPath();
                        context.moveTo(t.x, layerTop);
                        context.lineTo(t.x - layerHalfW, layerBottom);
                        context.lineTo(t.x + layerHalfW, layerBottom);
                        context.closePath();
                        context.fill();
                    }
                    // Subtle highlight stripe down the lit side.
                    context.fillStyle = 'rgba(220,255,200,0.25)';
                    context.beginPath();
                    context.moveTo(t.x - t.size * 0.05, topY + t.size * 0.05);
                    context.lineTo(t.x - t.size * 0.18, topY + t.size * 0.55);
                    context.lineTo(t.x - t.size * 0.05, topY + t.size * 0.55);
                    context.closePath();
                    context.fill();
                }
            }

            // Build a sorted, filtered draw list with index references — avoids cloning car objects.
            const trafficSrc = trafficRef.current;
            const drawWorldDist = worldDistanceRef.current;
            const drawList: Array<{ car: TrafficCar; relativeZ: number }> = [];
            for (let i = 0; i < trafficSrc.length; i += 1) {
                const c = trafficSrc[i];
                const rz = (c.distance - drawWorldDist) / 900;
                if (rz > 0.04 && rz < 1.2) {
                    drawList.push({ car: c, relativeZ: Math.min(1.18, rz) });
                }
            }
            drawList.sort((a, b) => a.relativeZ - b.relativeZ);
            for (let di = 0; di < drawList.length; di += 1) {
                const car = drawList[di].car;
                const relativeZ = drawList[di].relativeZ;
                {
                    const scale = 0.24 + (relativeZ * 1.05);
                    const isPickup = car.type === 'shield' || car.type === 'brick' || car.type === 'cake';
                    const bossScale = car.isBoss ? 1.45 : 1;
                    const carWidth = width * (isPickup ? 0.048 : 0.06) * scale * bossScale;
                    const carHeight = height * (isPickup ? 0.095 : 0.12) * scale * bossScale;
                    const laneForDraw = car.isBoss ? (car.displayLane ?? car.lane) : car.lane;
                    const carCenterX = projectLaneCenter(laneForDraw, relativeZ);
                    const carBottomY = projectY(relativeZ);
                    const carX = carCenterX - (carWidth / 2);
                    const carY = carBottomY - carHeight;

                    if (car.type === 'shield') {
                        drawShieldPowerUp(context, carX, carY, carWidth, carHeight);
                    } else if (car.type === 'brick') {
                        drawLegoBrick(context, carX, carY, carWidth, carHeight, time);
                    } else if (car.type === 'cake') {
                        drawCake(context, carX, carY, carWidth, carHeight, time);
                    } else if (car.type === 'police') {
                        if (car.isBoss) {
                            // Pulsing purple/red menace halo behind the boss.
                            const haloPulse = 0.55 + 0.45 * Math.sin(time * 0.012);
                            const haloR = carWidth * 0.85;
                            const halo = context.createRadialGradient(
                                carCenterX, carBottomY - carHeight * 0.5, 0,
                                carCenterX, carBottomY - carHeight * 0.5, haloR
                            );
                            halo.addColorStop(0, `rgba(168, 85, 247, ${0.45 * haloPulse})`);
                            halo.addColorStop(0.6, `rgba(220, 38, 38, ${0.25 * haloPulse})`);
                            halo.addColorStop(1, 'rgba(220, 38, 38, 0)');
                            context.fillStyle = halo;
                            context.fillRect(
                                carCenterX - haloR, carBottomY - carHeight * 0.5 - haloR,
                                haloR * 2, haloR * 2
                            );
                        }
                        context.fillStyle = 'rgba(0, 0, 0, 0.18)';
                        context.beginPath();
                        context.ellipse(carCenterX, carBottomY + 4, carWidth * 0.48, carHeight * 0.14, 0, 0, Math.PI * 2);
                        context.fill();
                        drawPoliceCar(context, carX, carY, carWidth, carHeight);
                        if (car.isBoss) {
                            // "BOSS" tag floating above.
                            context.save();
                            context.fillStyle = '#ffe066';
                            context.strokeStyle = '#1a1a2e';
                            context.lineWidth = 3;
                            context.font = `800 ${Math.max(12, carWidth * 0.32)}px sans-serif`;
                            context.textAlign = 'center';
                            context.strokeText('BOSS', carCenterX, carY - 6);
                            context.fillText('BOSS', carCenterX, carY - 6);
                            context.textAlign = 'left';
                            context.restore();
                        }
                    } else {
                        context.fillStyle = 'rgba(0, 0, 0, 0.18)';
                        context.beginPath();
                        context.ellipse(carCenterX, carBottomY + 4, carWidth * 0.48, carHeight * 0.14, 0, 0, Math.PI * 2);
                        context.fill();

                        drawCar(context, carX, carY, carWidth, carHeight, car.color, '#bfe7ff');
                    }
                }
            }

            const playerScale = 1.06;
            const usingMotorcycle = selectedVehicleRef.current === 'motorcycle' && motorcyclesUnlockedRef.current;
            const playerWidth = width * (usingMotorcycle ? 0.066 : 0.085) * playerScale;
            const playerHeight = height * (usingMotorcycle ? 0.165 : 0.19) * playerScale;
            const playerCenterX = projectLaneCenter(displayedLaneRef.current, playerZ);
            const playerBottomY = projectY(playerZ);
            const playerX = playerCenterX - (playerWidth / 2);
            const playerY = playerBottomY - playerHeight;

            context.fillStyle = 'rgba(0, 0, 0, 0.28)';
            context.beginPath();
            context.ellipse(playerCenterX, playerBottomY + 7, playerWidth * 0.42, playerHeight * 0.08, 0, 0, Math.PI * 2);
            context.fill();

            // Calculate car fade during explosion
            let carAlpha = 1;
            if (crashTimeRef.current !== null) {
                const crashElapsedMs = time - crashTimeRef.current;
                const crashFade = Math.max(0, 1 - (crashElapsedMs / 600));
                carAlpha = crashFade;
            }

            context.globalAlpha = carAlpha;
            if (usingMotorcycle) {
                const activeMotoSkin = getActiveMotoSkin();
                drawMotorcycle(context, playerX, playerY, playerWidth, playerHeight, activeMotoSkin.color, activeMotoSkin.windshield);
                drawCarWrap(context, playerX, playerY, playerWidth, playerHeight, activeMotoSkin.wrap, time);
            } else {
                const activeSkin = getActiveCarSkin();
                drawCar(context, playerX, playerY, playerWidth, playerHeight, activeSkin.color, activeSkin.windshield);
                drawCarWrap(context, playerX, playerY, playerWidth, playerHeight, activeSkin.wrap, time);
            }
            drawCarDamage(context, playerX, playerY, playerWidth, playerHeight, playerDamageRef.current);
            context.globalAlpha = 1;

            if (hasActiveShield) {
                const pulse = 0.82 + (Math.sin(time * 0.012) * 0.08);
                context.strokeStyle = 'rgba(77, 208, 225, 0.9)';
                context.lineWidth = Math.max(4, width * 0.0075);
                context.beginPath();
                context.ellipse(playerCenterX, playerBottomY - (playerHeight * 0.48), playerWidth * 0.7 * pulse, playerHeight * 0.62 * pulse, 0, 0, Math.PI * 2);
                context.stroke();
            }

            drawCrashExplosion(context, time);
            drawWeatherEffects(context, width, height);

            // Draw confetti — in-place compaction, no per-frame array allocation.
            const confetti = confettiRef.current;
            let confettiWrite = 0;
            for (let i = 0; i < confetti.length; i += 1) {
                const p = confetti[i];
                const age = time - p.startTime;
                if (age > 2800) continue;
                confetti[confettiWrite++] = p;
                const alpha = 1 - age / 2800;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.12;
                p.rotation += p.spin;
                context.save();
                context.globalAlpha = alpha;
                context.translate(p.x, p.y);
                context.rotate(p.rotation);
                context.fillStyle = p.color;
                context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                context.restore();
            }
            confetti.length = confettiWrite;

            // Draw achievement toast
            if (pendingAchievementToastRef.current && time < pendingAchievementToastRef.current.until) {
                const toast = pendingAchievementToastRef.current;
                const toastAge = (toast.until - 3500) + 3500 - toast.until + (time - (toast.until - 3500));
                const alpha = Math.min(1, Math.min(toastAge / 300, (toast.until - time) / 500));
                const toastW = 220;
                const toastH = 48;
                const toastX = (width - toastW) / 2;
                const toastY = height * 0.08;
                context.save();
                context.globalAlpha = alpha;
                context.fillStyle = '#1a1a2e';
                context.beginPath();
                context.roundRect(toastX, toastY, toastW, toastH, 10);
                context.fill();
                context.strokeStyle = '#ffcf00';
                context.lineWidth = 2;
                context.beginPath();
                context.roundRect(toastX, toastY, toastW, toastH, 10);
                context.stroke();
                context.fillStyle = '#ffcf00';
                context.font = '700 13px sans-serif';
                context.textAlign = 'center';
                context.fillText('🏆 Achievement Unlocked!', toastX + toastW / 2, toastY + 17);
                context.fillStyle = '#ffffff';
                context.font = '600 13px sans-serif';
                context.fillText(`${toast.emoji} ${toast.label}`, toastX + toastW / 2, toastY + 35);
                context.textAlign = 'left';
                context.restore();
            } else if (pendingAchievementToastRef.current && time >= pendingAchievementToastRef.current.until) {
                pendingAchievementToastRef.current = null;
            }

            // Draw streak milestone toast (every 10). Top-center, compact.
            if (pendingStreakToastRef.current && time < pendingStreakToastRef.current.until) {
                const toast = pendingStreakToastRef.current;
                const totalMs = 2200;
                const remaining = toast.until - time;
                const elapsed = totalMs - remaining;
                const alpha = Math.min(1, Math.min(elapsed / 200, remaining / 400));
                // Slight pop-in scale during first 200ms.
                const scale = 1 + Math.max(0, (200 - elapsed)) / 600;
                const toastW = 180;
                const toastH = 42;
                const toastX = (width - toastW) / 2;
                const toastY = height * 0.18;
                context.save();
                context.globalAlpha = alpha;
                context.translate(toastX + toastW / 2, toastY + toastH / 2);
                context.scale(scale, scale);
                context.translate(-(toastX + toastW / 2), -(toastY + toastH / 2));
                context.fillStyle = '#1a1a2e';
                context.beginPath();
                context.roundRect(toastX, toastY, toastW, toastH, 8);
                context.fill();
                context.strokeStyle = '#ff7b00';
                context.lineWidth = 1.5;
                context.beginPath();
                context.roundRect(toastX, toastY, toastW, toastH, 8);
                context.stroke();
                context.fillStyle = '#ff7b00';
                context.font = '800 12px sans-serif';
                context.textAlign = 'center';
                context.fillText(`🔥 ${toast.streak} STREAK!`, toastX + toastW / 2, toastY + 16);
                context.fillStyle = '#ffd600';
                context.font = '700 11px sans-serif';
                context.fillText(`${toast.multiplier}x score multiplier`, toastX + toastW / 2, toastY + 32);
                context.textAlign = 'left';
                context.restore();
            } else if (pendingStreakToastRef.current && time >= pendingStreakToastRef.current.until) {
                pendingStreakToastRef.current = null;
            }

            // Draw generic unlock toast (e.g. hidden Mobiles tab). Same look as the streak toast,
            // slightly wider for the longer copy and a longer dwell so the player actually reads it.
            if (pendingUnlockToastRef.current && time < pendingUnlockToastRef.current.until) {
                const toast = pendingUnlockToastRef.current;
                const totalMs = 4000;
                const remaining = toast.until - time;
                const elapsed = totalMs - remaining;
                const alpha = Math.min(1, Math.min(elapsed / 250, remaining / 500));
                const scale = 1 + Math.max(0, (250 - elapsed)) / 600;
                const toastW = 260;
                const toastH = 46;
                const toastX = (width - toastW) / 2;
                const toastY = height * 0.28;
                context.save();
                context.globalAlpha = alpha;
                context.translate(toastX + toastW / 2, toastY + toastH / 2);
                context.scale(scale, scale);
                context.translate(-(toastX + toastW / 2), -(toastY + toastH / 2));
                context.fillStyle = '#1a1a2e';
                context.beginPath();
                context.roundRect(toastX, toastY, toastW, toastH, 8);
                context.fill();
                context.strokeStyle = '#7e22ce';
                context.lineWidth = 1.5;
                context.beginPath();
                context.roundRect(toastX, toastY, toastW, toastH, 8);
                context.stroke();
                context.fillStyle = '#c084fc';
                context.font = '800 13px sans-serif';
                context.textAlign = 'center';
                context.fillText(toast.title, toastX + toastW / 2, toastY + 18);
                context.fillStyle = '#ffd600';
                context.font = '700 11px sans-serif';
                context.fillText(toast.subtitle, toastX + toastW / 2, toastY + 35);
                context.textAlign = 'left';
                context.restore();
            } else if (pendingUnlockToastRef.current && time >= pendingUnlockToastRef.current.until) {
                pendingUnlockToastRef.current = null;
            }

            context.globalAlpha = 1 - (1 - lightingIntensityRef.current) * 0.3;
            // Layered grass: lighter base + darker patches for depth.
            context.fillStyle = '#83c35d';
            context.fillRect(0, roadBottomY, width, height - roadBottomY);
            context.fillStyle = '#6fb14b';
            for (let i = 0; i < 14; i += 1) {
                const px = ((i * width) / 13 + Math.sin(i * 1.7) * 10);
                const pw = width * 0.12;
                const py = roadBottomY + 4 + (i % 3) * 6;
                context.beginPath();
                context.ellipse(px, py, pw * 0.5, 8, 0, 0, Math.PI * 2);
                context.fill();
            }
            context.globalAlpha = 1;

            // Foreground bushes — multi-blob with highlights.
            for (let i = 0; i < 7; i += 1) {
                const shrubX = (i * width) / 6;
                const shrubY = roadBottomY + 18 + (i % 2) * 6;
                const shrubR = 26 + (i % 3) * 4;
                context.fillStyle = '#4d8a3a';
                context.beginPath();
                context.arc(shrubX, shrubY, shrubR, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = '#6db04c';
                context.beginPath();
                context.arc(shrubX - shrubR * 0.4, shrubY - shrubR * 0.2, shrubR * 0.65, 0, Math.PI * 2);
                context.arc(shrubX + shrubR * 0.4, shrubY - shrubR * 0.1, shrubR * 0.6, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = 'rgba(220,255,200,0.35)';
                context.beginPath();
                context.arc(shrubX - shrubR * 0.25, shrubY - shrubR * 0.35, shrubR * 0.22, 0, Math.PI * 2);
                context.fill();
            }

            // Foreground pine trees flanking the very bottom edges — big and bold.
            for (let side = -1 as -1 | 1; side <= 1; side += 2) {
                const baseX = side === -1 ? width * 0.04 : width * 0.96;
                const baseY = height - 6;
                const treeH = height * 0.18;
                context.fillStyle = '#5d3b22';
                context.fillRect(baseX - 4, baseY - treeH * 0.18, 8, treeH * 0.18);
                for (let l = 0; l < 4; l += 1) {
                    const lt = baseY - treeH * (0.18 + l * 0.22);
                    const halfW = treeH * (0.18 + l * 0.07);
                    const lb = lt + treeH * 0.32;
                    context.fillStyle = l % 2 === 0 ? '#2f6b3a' : '#3f8e4a';
                    context.beginPath();
                    context.moveTo(baseX, lt);
                    context.lineTo(baseX - halfW, lb);
                    context.lineTo(baseX + halfW, lb);
                    context.closePath();
                    context.fill();
                }
            }

            // Sprinkle of flowers across the foreground grass.
            for (let i = 0; i < 22; i += 1) {
                const fx = ((i * 53) % width);
                const fy = roadBottomY + 6 + ((i * 17) % Math.max(8, (height - roadBottomY) - 12));
                const colors = ['#ff5e8a', '#ffd54f', '#ffffff', '#c98bff', '#ff9a3c'];
                context.fillStyle = colors[i % colors.length];
                // 4-petal little flower.
                for (let p = 0; p < 4; p += 1) {
                    const a = (p / 4) * Math.PI * 2;
                    context.beginPath();
                    context.arc(fx + Math.cos(a) * 2, fy + Math.sin(a) * 2, 1.8, 0, Math.PI * 2);
                    context.fill();
                }
                context.fillStyle = '#ffd54f';
                context.beginPath();
                context.arc(fx, fy, 1.2, 0, Math.PI * 2);
                context.fill();
            }

            context.fillStyle = '#1f2933';
            context.font = '700 18px sans-serif';
            context.fillText(`Score: ${scoreRef.current}`, 16, 28);
            context.fillText(`Best: ${bestScoreRef.current}`, 16, 52);
            context.fillStyle = '#c8a600';
            context.fillText(`⬡ ${studsRef.current} studs`, 16, 76);
            
            drawHearts(context, width, playerLivesRef.current);

            // Update + draw any hearts flying from a cake pickup to their HUD slot.
            if (flyingHeartsRef.current.length > 0) {
                const heartSize = 24;
                const startX = width - (heartSize * 3.5) - 12;
                const startY = 16;
                const flying = flyingHeartsRef.current;
                let writeIdx = 0;
                for (let i = 0; i < flying.length; i += 1) {
                    const fh = flying[i];
                    const elapsed = time - fh.startTime;
                    const t = Math.min(1, elapsed / fh.duration);
                    if (t >= 1) {
                        // Land: actually grant the heart now (still capped at 3).
                        if (!fh.landed) {
                            fh.landed = true;
                            if (playerLivesRef.current < 3) {
                                playerLivesRef.current = Math.min(3, playerLivesRef.current + 1);
                            }
                        }
                        continue; // drop from list
                    }
                    flying[writeIdx++] = fh;

                    const targetX = startX + (fh.slotIndex * (heartSize + 8));
                    const targetY = startY + heartSize * 0.4;
                    // Ease-out so the heart drifts up gently and settles.
                    const ease = 1 - Math.pow(1 - t, 2);
                    const cx = fh.startX + (targetX - fh.startX) * ease;
                    const cy = fh.startY + (targetY - fh.startY) * ease;
                    const scale = 1.4 - 0.4 * ease;
                    const wobble = Math.sin(elapsed / 120) * 8 * (1 - t);
                    const hx = cx + wobble;
                    const hy = cy;
                    const hs = heartSize * scale;
                    const alpha = 0.85 + 0.15 * Math.sin(elapsed / 90);
                    context.globalAlpha = alpha;
                    context.fillStyle = '#ff4d6d';
                    context.beginPath();
                    context.moveTo(hx, hy + hs * 0.35);
                    context.bezierCurveTo(hx + hs * 0.6, hy - hs * 0.2, hx + hs * 0.2, hy - hs * 0.55, hx, hy - hs * 0.15);
                    context.bezierCurveTo(hx - hs * 0.2, hy - hs * 0.55, hx - hs * 0.6, hy - hs * 0.2, hx, hy + hs * 0.35);
                    context.fill();
                    // Soft glow trail
                    context.globalAlpha = 0.18 * (1 - t);
                    context.beginPath();
                    context.arc(hx, hy, hs * 0.7, 0, Math.PI * 2);
                    context.fill();
                    context.globalAlpha = 1;
                }
                flying.length = writeIdx;
            }
            
            if (hasActiveShield) {
                context.fillStyle = '#007c91';
                context.fillText(`Shield: ${Math.max(0, Math.ceil((shieldUntilRef.current - time) / 1000))}s`, 16, 100);
            }
            if (developerModeRef.current) {
                context.fillStyle = '#8e24aa';
                context.fillText('DEV MODE: IMMORTAL', 16, hasActiveShield ? 124 : 100);
            }

            if (!isGameStartedRef.current && isFirstLoadRef.current) {
                context.fillStyle = 'rgba(17, 24, 39, 0.6)';
                context.fillRect(0, 0, width, height);
                context.fillStyle = '#ffffff';
                context.textAlign = 'center';
                context.font = '700 36px sans-serif';
                context.fillText('Ready?', width / 2, height / 2 - 30);
                context.font = '600 18px sans-serif';
                context.fillText('Press Space, Arrow Up, Enter, or tap to start', width / 2, height / 2 + 20);
                context.textAlign = 'left';
            } else if (isPausedRef.current) {
                context.fillStyle = 'rgba(17, 24, 39, 0.6)';
                context.fillRect(0, 0, width, height);
                context.fillStyle = '#ffffff';
                context.textAlign = 'center';
                context.font = '700 34px sans-serif';
                context.fillText('Paused', width / 2, height / 2 - 88);
                context.font = '600 16px sans-serif';
                context.fillText('Press Escape to resume', width / 2, height / 2 - 56);

                const leaderboardScores = leaderboardRef.current.slice(0, 5);
                context.font = '700 17px sans-serif';
                context.fillText('Top Scores', width / 2, height / 2 - 18);
                context.font = '600 15px sans-serif';
                if (leaderboardScores.length === 0) {
                    context.fillText('No scores yet', width / 2, height / 2 + 4);
                } else {
                    leaderboardScores.forEach((scoreValue, index) => {
                        context.fillText(`${index + 1}. ${scoreValue}`, width / 2, (height / 2) + 4 + (index * 20));
                    });
                }

                context.font = '600 15px sans-serif';
                context.fillText(`Current Score: ${scoreRef.current}`, width / 2, height / 2 + 122);
                context.textAlign = 'left';
            } else if (isGameOverRef.current) {
                const crashElapsedMs = crashTimeRef.current === null ? 1000 : time - crashTimeRef.current;
                const overlayFadeProgress = Math.min(1, Math.max(0, crashElapsedMs / 1000));
                context.fillStyle = `rgba(17, 24, 39, ${0.72 * overlayFadeProgress})`;
                context.fillRect(0, 0, width, height);
                context.fillStyle = `rgba(255, 255, 255, ${overlayFadeProgress})`;
                context.textAlign = 'center';
                context.font = '700 30px sans-serif';
                context.fillText('Crash!', width / 2, height / 2 - 58);
                context.font = '600 16px sans-serif';
                context.fillText('Press Space, Arrow Up, W, or tap to restart', width / 2, height / 2 - 24);

                const leaderboardScores = leaderboardRef.current.slice(0, 5);
                context.font = '700 17px sans-serif';
                context.fillText('Top Scores', width / 2, height / 2 + 8);
                context.font = '600 15px sans-serif';
                if (leaderboardScores.length === 0) {
                    context.fillText('No scores yet', width / 2, height / 2 + 30);
                } else {
                    leaderboardScores.forEach((scoreValue, index) => {
                        context.fillText(`${index + 1}. ${scoreValue}`, width / 2, (height / 2) + 30 + (index * 20));
                    });
                }
                context.textAlign = 'left';
            }

            animationFrameRef.current = window.requestAnimationFrame(draw);
            shieldWasActiveLastFrameRef.current = hasActiveShield;
        };

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('keydown', keyListener);
        window.addEventListener('keyup', keyUpListener);
        animationFrameRef.current = window.requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('keydown', keyListener);
            window.removeEventListener('keyup', keyUpListener);
            if (animationFrameRef.current) {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            stopRainSound();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                void audioContextRef.current.close().catch(() => undefined);
                audioContextRef.current = null;
            }
        };
    }, [moveLane, resetGame, startGame, updateUi]);

    // Stable shop handlers — refs hold the source of truth, updateUi flushes a single batched re-render.
    const selectCarSkin = useCallback((skinId: CarSkinId) => {
        selectedSkinRef.current = skinId;
        selectedVehicleRef.current = 'car';
        updateUi({ selectedSkin: skinId, selectedVehicle: 'car' });
        window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'car');
        window.localStorage.setItem(SELECTED_SKIN_STORAGE_KEY, skinId);
    }, [updateUi]);

    const buyCarSkin = useCallback((skinId: CarSkinId, cost: number) => {
        const devMode = developerModeRef.current;
        const patch: Partial<UiState> = {};
        if (!devMode) {
            const newStuds = studsRef.current - cost;
            studsRef.current = newStuds;
            patch.studs = newStuds;
            window.localStorage.setItem(STUDS_STORAGE_KEY, String(newStuds));
        }
        const newUnlocked = new Set(unlockedSkinsRef.current);
        newUnlocked.add(skinId);
        unlockedSkinsRef.current = newUnlocked;
        patch.unlockedSkins = new Set(newUnlocked);
        window.localStorage.setItem(UNLOCKED_SKINS_STORAGE_KEY, JSON.stringify([...newUnlocked]));
        selectedSkinRef.current = skinId;
        selectedVehicleRef.current = 'car';
        patch.selectedSkin = skinId;
        patch.selectedVehicle = 'car';
        window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'car');
        window.localStorage.setItem(SELECTED_SKIN_STORAGE_KEY, skinId);
        gameStatsRef.current.skinsOwned = newUnlocked.size + (motorcyclesUnlockedRef.current ? unlockedMotorcycleSkinsRef.current.size : 0);
        window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameStatsRef.current));
        updateUi(patch);
    }, [updateUi]);

    const selectMotorcycleSkin = useCallback((skinId: MotorcycleSkinId) => {
        selectedMotorcycleSkinRef.current = skinId;
        selectedVehicleRef.current = 'motorcycle';
        updateUi({ selectedMotorcycleSkin: skinId, selectedVehicle: 'motorcycle' });
        window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'motorcycle');
        window.localStorage.setItem(SELECTED_MOTORCYCLE_SKIN_STORAGE_KEY, skinId);
    }, [updateUi]);

    const buyMotorcycleSkin = useCallback((skinId: MotorcycleSkinId, cost: number) => {
        const devMode = developerModeRef.current;
        const patch: Partial<UiState> = {};
        if (!devMode) {
            const newStuds = studsRef.current - cost;
            studsRef.current = newStuds;
            patch.studs = newStuds;
            window.localStorage.setItem(STUDS_STORAGE_KEY, String(newStuds));
        }
        const newUnlocked = new Set(unlockedMotorcycleSkinsRef.current);
        newUnlocked.add(skinId);
        unlockedMotorcycleSkinsRef.current = newUnlocked;
        patch.unlockedMotorcycleSkins = new Set(newUnlocked);
        window.localStorage.setItem(UNLOCKED_MOTORCYCLE_SKINS_STORAGE_KEY, JSON.stringify([...newUnlocked]));
        selectedMotorcycleSkinRef.current = skinId;
        selectedVehicleRef.current = 'motorcycle';
        patch.selectedMotorcycleSkin = skinId;
        patch.selectedVehicle = 'motorcycle';
        window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'motorcycle');
        window.localStorage.setItem(SELECTED_MOTORCYCLE_SKIN_STORAGE_KEY, skinId);
        gameStatsRef.current.skinsOwned = unlockedSkinsRef.current.size + newUnlocked.size;
        window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameStatsRef.current));
        updateUi(patch);
    }, [updateUi]);

    const unlockMotorcycles = useCallback(() => {
        const devMode = developerModeRef.current;
        if (!devMode && studsRef.current < 100) {
            return;
        }
        const patch: Partial<UiState> = {
            motorcyclesUnlocked: true,
            selectedVehicle: 'motorcycle',
        };
        if (!devMode) {
            studsRef.current -= 100;
            patch.studs = studsRef.current;
            window.localStorage.setItem(STUDS_STORAGE_KEY, String(studsRef.current));
        }
        motorcyclesUnlockedRef.current = true;
        selectedVehicleRef.current = 'motorcycle';
        window.localStorage.setItem(MOTORCYCLES_UNLOCKED_STORAGE_KEY, '1');
        gameStatsRef.current.skinsOwned = unlockedSkinsRef.current.size + unlockedMotorcycleSkinsRef.current.size;
        window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameStatsRef.current));
        window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'motorcycle');
        updateUi(patch);
    }, [updateUi]);

    const renderSkinPreview = (skin: (typeof CAR_SKINS)[number]) => {
        const clipId = `cc-${skin.id}`;
        const strokeColor = skin.color === '#ffcf00' || skin.color === '#eeeeee' ? '#999' : 'rgba(0,0,0,0.3)';
        const galaxyWrap = skin.wrap.startsWith('galaxy');
        const newAnimatedWrap = ['neon_stream', 'pulse_grid', 'thunder_wave', 'lava_flow', 'holo_shift', 'matrix_rain'].includes(skin.wrap);
        return (
            <svg width="40" height="58" viewBox="0 0 40 58" key={skin.id}>
                <defs>
                    <clipPath id={clipId}>
                        <rect x="2" y="12" width="36" height="40" rx="5" />
                    </clipPath>
                </defs>
                <rect x="7" y="6" width="10" height="8" rx="3" fill={skin.color} stroke={strokeColor} strokeWidth="1" />
                <rect x="23" y="6" width="10" height="8" rx="3" fill={skin.color} stroke={strokeColor} strokeWidth="1" />
                <rect x="2" y="12" width="36" height="40" rx="5" fill={skin.color} stroke={strokeColor} strokeWidth="1.5" />
                <g clipPath={`url(#${clipId})`}>
                    {skin.wrap === 'stripes_black' && <>
                        <polygon points="11,12 18,12 10,52 3,52" fill="rgba(0,0,0,0.48)" />
                        <polygon points="24,12 31,12 23,52 16,52" fill="rgba(0,0,0,0.48)" />
                    </>}
                    {skin.wrap === 'stripes_red' && <>
                        <rect x="15.5" y="12" width="4" height="40" fill="#e53935" />
                        <rect x="20.5" y="12" width="4" height="40" fill="#e53935" />
                    </>}
                    {skin.wrap === 'checker' && <>
                        <rect x="2"  y="33" width="9" height="9"  fill="rgba(255,255,255,0.75)" />
                        <rect x="20" y="33" width="9" height="9"  fill="rgba(255,255,255,0.75)" />
                        <rect x="11" y="42" width="9" height="10" fill="rgba(255,255,255,0.75)" />
                        <rect x="29" y="42" width="9" height="10" fill="rgba(255,255,255,0.75)" />
                    </>}
                    {skin.wrap === 'flames' && <>
                        <path d="M6,52 C4,44 12,36 14,40 C15,34 19,46 20,52 Z" fill="#ff6d00" />
                        <path d="M20,52 C22,46 26,34 27,40 C29,36 36,44 34,52 Z" fill="#ff6d00" />
                        <path d="M16,52 C14,44 20,30 24,44 C25,48 24,52 16,52 Z" fill="#ffea00" />
                    </>}
                    {skin.wrap === 'carbon' && <>
                        <line x1="2" y1="19" x2="38" y2="19" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="2" y1="26" x2="38" y2="26" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="2" y1="33" x2="38" y2="33" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="2" y1="40" x2="38" y2="40" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="2" y1="47" x2="38" y2="47" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="9"  y1="12" x2="9"  y2="52" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="16" y1="12" x2="16" y2="52" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="23" y1="12" x2="23" y2="52" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                        <line x1="30" y1="12" x2="30" y2="52" stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
                    </>}
                    {galaxyWrap && <>
                        <circle cx="8"  cy="17" r="1.5" fill="white" opacity="0.9" />
                        <circle cx="20" cy="14" r="1.2" fill="white" opacity="0.8" />
                        <circle cx="34" cy="19" r="1.6" fill="white" opacity="0.9" />
                        <circle cx="12" cy="28" r="1.0" fill="white" opacity="0.7" />
                        <circle cx="28" cy="24" r="1.4" fill="white" opacity="0.8" />
                        <circle cx="36" cy="32" r="1.1" fill="white" opacity="0.7" />
                        <circle cx="16" cy="38" r="1.6" fill="white" opacity="0.9" />
                        <circle cx="25" cy="44" r="1.2" fill="white" opacity="0.8" />
                        <circle cx="7"  cy="46" r="1.0" fill="white" opacity="0.7" />
                        <circle cx="33" cy="48" r="1.4" fill="white" opacity="0.8" />
                        <defs>
                            <linearGradient id={`gg-${skin.id}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#e91e63" stopOpacity="0.2" />
                                <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                                <stop offset="100%" stopColor="#673ab7" stopOpacity="0.2" />
                            </linearGradient>
                        </defs>
                        <rect x="2" y="12" width="36" height="40" fill={`url(#gg-${skin.id})`} />
                    </>}
                    {newAnimatedWrap && skin.wrap === 'neon_stream' && <>
                        <polygon points="2,50 10,50 23,12 15,12" fill="rgba(0,229,255,0.45)" />
                        <polygon points="14,52 22,52 35,14 27,14" fill="rgba(0,229,255,0.35)" />
                    </>}
                    {newAnimatedWrap && skin.wrap === 'pulse_grid' && <>
                        <rect x="2" y="12" width="36" height="40" fill="rgba(76,175,80,0.16)" />
                        <line x1="2" y1="20" x2="38" y2="20" stroke="rgba(178,255,89,0.6)" strokeWidth="1" />
                        <line x1="2" y1="30" x2="38" y2="30" stroke="rgba(178,255,89,0.6)" strokeWidth="1" />
                        <line x1="2" y1="40" x2="38" y2="40" stroke="rgba(178,255,89,0.6)" strokeWidth="1" />
                        <line x1="10" y1="12" x2="10" y2="52" stroke="rgba(178,255,89,0.6)" strokeWidth="1" />
                        <line x1="20" y1="12" x2="20" y2="52" stroke="rgba(178,255,89,0.6)" strokeWidth="1" />
                        <line x1="30" y1="12" x2="30" y2="52" stroke="rgba(178,255,89,0.6)" strokeWidth="1" />
                    </>}
                    {newAnimatedWrap && skin.wrap === 'thunder_wave' && <>
                        <path d="M4,20 C10,14 14,26 20,20 C25,15 29,24 36,18" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" fill="none" />
                        <path d="M4,33 C9,28 14,38 20,33 C24,29 30,36 36,32" stroke="rgba(126,87,194,0.85)" strokeWidth="1.4" fill="none" />
                        <path d="M4,45 C11,39 16,50 22,44 C28,39 33,48 36,43" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" fill="none" />
                    </>}
                    {newAnimatedWrap && skin.wrap === 'lava_flow' && <>
                        <path d="M2,26 C10,18 16,30 24,22 C30,17 34,24 38,20 L38,52 L2,52 Z" fill="rgba(255,87,34,0.48)" />
                        <path d="M2,36 C8,30 16,41 24,34 C30,30 34,38 38,34 L38,52 L2,52 Z" fill="rgba(255,193,7,0.38)" />
                    </>}
                    {newAnimatedWrap && skin.wrap === 'holo_shift' && <>
                        <defs>
                            <linearGradient id={`hh-${skin.id}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#ff4081" stopOpacity="0.45" />
                                <stop offset="50%" stopColor="#00e5ff" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#7c4dff" stopOpacity="0.45" />
                            </linearGradient>
                        </defs>
                        <rect x="2" y="12" width="36" height="40" fill={`url(#hh-${skin.id})`} />
                    </>}
                    {newAnimatedWrap && skin.wrap === 'matrix_rain' && <>
                        <rect x="4"  y="14" width="2" height="36" fill="rgba(178,255,89,0.35)" />
                        <rect x="10" y="13" width="2" height="37" fill="rgba(178,255,89,0.35)" />
                        <rect x="16" y="15" width="2" height="35" fill="rgba(178,255,89,0.35)" />
                        <rect x="22" y="13" width="2" height="37" fill="rgba(178,255,89,0.35)" />
                        <rect x="28" y="14" width="2" height="36" fill="rgba(178,255,89,0.35)" />
                        <rect x="34" y="15" width="2" height="35" fill="rgba(178,255,89,0.35)" />
                        <rect x="4" y="22" width="2" height="4" fill="rgba(204,255,144,0.95)" />
                        <rect x="16" y="30" width="2" height="4" fill="rgba(204,255,144,0.95)" />
                        <rect x="28" y="40" width="2" height="4" fill="rgba(204,255,144,0.95)" />
                    </>}
                    {skin.wrap === 'nate' && <>
                        <rect x="17" y="14" width="2" height="28" fill="rgba(123,31,162,0.95)" />
                        <rect x="21" y="14" width="2" height="28" fill="rgba(123,31,162,0.95)" />
                        <rect x="17.5" y="14" width="1" height="28" fill="rgba(255,180,255,0.9)" />
                        <rect x="21.5" y="14" width="1" height="28" fill="rgba(255,180,255,0.9)" />
                        <polygon points="17,18 24,18 19.5,25 22,25 16,33 19,25 17,25" fill="#ce93d8" stroke="#ffffff" strokeWidth="0.4" />
                        <circle cx="6" cy="34" r="1.4" fill="#e040fb" opacity="0.7" />
                        <circle cx="34" cy="30" r="1.2" fill="#e040fb" opacity="0.7" />
                        <text x="20" y="50" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="#f3e5ff" stroke="rgba(20,0,40,0.9)" strokeWidth="0.4">Nate-Mobile</text>
                    </>}
                    {skin.wrap === 'esben' && <>
                        <polygon points="9,18 12,14 15,18" fill="#ffffff" />
                        <polygon points="20,16 23,12 26,16" fill="#ffffff" />
                        <polygon points="29,18 32,14 35,18" fill="#ffffff" />
                        <polyline points="6,22 9,28 6,34 9,40" stroke="#7cdcff" strokeWidth="1" fill="none" />
                        <polyline points="34,22 31,28 34,34 31,40" stroke="#7cdcff" strokeWidth="1" fill="none" />
                        <text x="20" y="50" textAnchor="middle" fontSize="4" fontWeight="700" fill="#e1f5ff" stroke="rgba(0,20,40,0.8)" strokeWidth="0.35">Esben-Mobile</text>
                    </>}
                    {skin.wrap === 'jakob' && <>
                        <path d="M3,24 Q10,28 20,24 T37,24 L37,16 L3,16 Z" fill="rgba(170,255,90,0.85)" />
                        <circle cx="10" cy="32" r="2" fill="#aaff5a" />
                        <circle cx="22" cy="38" r="1.6" fill="#aaff5a" />
                        <circle cx="30" cy="30" r="1.4" fill="#aaff5a" />
                        <text x="20" y="50" textAnchor="middle" fontSize="4" fontWeight="700" fill="#e9ffcf" stroke="rgba(0,30,0,0.8)" strokeWidth="0.35">Jakob-Mobile</text>
                    </>}
                    {skin.wrap === 'emil' && <>
                        <rect x="17" y="14" width="2" height="28" fill="rgba(255,200,40,0.95)" />
                        <rect x="21" y="14" width="2" height="28" fill="rgba(255,200,40,0.95)" />
                        <polygon points="13,24 16,20 18,24 20,18 22,24 24,20 27,24 27,28 13,28" fill="#ffd700" stroke="rgba(80,50,0,0.8)" strokeWidth="0.5" />
                        <circle cx="16" cy="24" r="0.9" fill="#ff4081" />
                        <circle cx="20" cy="22" r="0.9" fill="#7cdcff" />
                        <circle cx="24" cy="24" r="0.9" fill="#aaff5a" />
                        <text x="20" y="50" textAnchor="middle" fontSize="4" fontWeight="700" fill="#fff3b0" stroke="rgba(60,30,0,0.85)" strokeWidth="0.35" fontFamily="serif">Emil-Mobile</text>
                    </>}
                    {skin.wrap === 'kasper' && <>
                        <circle cx="14" cy="18" r="1.4" fill="#ff3838" />
                        <circle cx="26" cy="18" r="1.4" fill="#ff3838" />
                        <circle cx="20" cy="28" r="6" fill="#f5f5f5" />
                        <rect x="16" y="28" width="8" height="4" fill="#f5f5f5" />
                        <circle cx="17.5" cy="27" r="1.3" fill="#0a0a0a" />
                        <circle cx="22.5" cy="27" r="1.3" fill="#0a0a0a" />
                        <rect x="17" y="31.5" width="1.2" height="2" fill="#0a0a0a" />
                        <rect x="19" y="31.5" width="1.2" height="2" fill="#0a0a0a" />
                        <rect x="21" y="31.5" width="1.2" height="2" fill="#0a0a0a" />
                        <text x="20" y="50" textAnchor="middle" fontSize="4" fontWeight="700" fill="#f5f5f5" stroke="rgba(0,0,0,0.85)" strokeWidth="0.35">Kasper-Mobile</text>
                    </>}
                </g>
                <rect x="8"  y="17" width="24" height="12" rx="3" fill={skin.windshield} />
                <rect x="10" y="33" width="20" height="10" rx="2" fill={skin.windshield} />
            </svg>
        );
    };

    const renderMotorcyclePreview = (skin: (typeof MOTORCYCLE_SKINS)[number]) => {
        const clipId = `mc-${skin.id}`;
        return (
            <svg width="44" height="44" viewBox="0 0 44 44" key={skin.id}>
                <defs>
                    <clipPath id={clipId}>
                        <rect x="11" y="12" width="23" height="14" rx="4" />
                    </clipPath>
                </defs>
                <circle cx="11" cy="32" r="6" fill="#111" />
                <circle cx="33" cy="32" r="6" fill="#111" />
                <path d="M11 32 L21 19 L30 21 L33 32" stroke="#222" strokeWidth="3" fill="none" />
                <rect x="11" y="12" width="23" height="14" rx="4" fill={skin.color} stroke="rgba(0,0,0,0.35)" />
                <g clipPath={`url(#${clipId})`}>
                    {(skin.wrap === 'moto_stream' || skin.wrap === 'moto_pulse') && <>
                        <rect x="11" y="16" width="23" height="3" fill="rgba(0,255,255,0.45)" />
                        <rect x="11" y="21" width="23" height="3" fill="rgba(255,255,255,0.3)" />
                    </>}
                    {(skin.wrap === 'moto_ember' || skin.wrap === 'moto_ion') && <>
                        <path d="M12,25 C16,15 26,14 32,25" fill="rgba(255,152,0,0.35)" />
                    </>}
                    {skin.wrap.startsWith('moto_galaxy') && <>
                        <circle cx="16" cy="15" r="1.2" fill="white" opacity="0.85" />
                        <circle cx="24" cy="18" r="1.0" fill="white" opacity="0.7" />
                        <circle cx="30" cy="14" r="1.3" fill="white" opacity="0.82" />
                        <rect x="11" y="12" width="23" height="14" fill={`url(#mm-g-${skin.id})`} opacity="0.35" />
                        <defs>
                            <linearGradient id={`mm-g-${skin.id}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#ff4081" stopOpacity="0.7" />
                                <stop offset="100%" stopColor="#7c4dff" stopOpacity="0.7" />
                            </linearGradient>
                        </defs>
                    </>}
                </g>
                <rect x="22" y="8" width="8" height="6" rx="2" fill={skin.windshield} />
            </svg>
        );
    };

    // Precompute SVG previews once — they only depend on the constant skin definitions
    // so they never need to re-render with the rest of the component tree.
    const carSkinPreviews = useMemo(() => {
        const map = {} as Record<CarSkinId, ReactElement>;
        CAR_SKINS.forEach((skin) => { map[skin.id] = renderSkinPreview(skin); });
        return map;
    }, []);
    const motorcycleSkinPreviews = useMemo(() => {
        const map = {} as Record<MotorcycleSkinId, ReactElement>;
        MOTORCYCLE_SKINS.forEach((skin) => { map[skin.id] = renderMotorcyclePreview(skin); });
        return map;
    }, []);

    // Memoize shop grids so they only rebuild when their actual inputs change.
    // Reusable card renderer keeps Cars and Mobiles tabs visually identical.
    const renderCarSkinCard = (skin: (typeof CAR_SKINS)[number]) => {
        const isOwned = unlockedSkins.has(skin.id);
        const isSelected = selectedSkin === skin.id;
        const canBuy = !isOwned && (isDeveloperMode || studs >= skin.cost);
        return (
            <div
                key={skin.id}
                style={{
                    background: isSelected ? '#ffd600' : isOwned ? '#1e3a5f' : '#2d2d2d',
                    border: isSelected ? '2px solid #fff176' : '2px solid transparent',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '100px',
                    cursor: isOwned || canBuy ? 'pointer' : 'default',
                    opacity: !isOwned && !canBuy ? 0.5 : 1,
                }}
                onClick={() => {
                    if (isOwned) {
                        selectCarSkin(skin.id);
                    } else if (canBuy) {
                        buyCarSkin(skin.id, skin.cost);
                    }
                }}
            >
                {carSkinPreviews[skin.id]}
                <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#1a1a1a' : 'white', textAlign: 'center' }}>{skin.label}</span>
                {isOwned ? (
                    <span style={{ fontSize: '11px', color: isSelected ? '#555' : '#7ec8e3' }}>{isSelected ? '✓ Selected' : 'Owned'}</span>
                ) : (
                    <span style={{ fontSize: '11px', color: '#ffd600' }}>{skin.cost} studs</span>
                )}
            </div>
        );
    };

    const carShopGrid = useMemo(() => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {CAR_SKINS.filter((s) => !MOBILE_SKIN_IDS.has(s.id)).map(renderCarSkinCard)}
        </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [unlockedSkins, selectedSkin, isDeveloperMode, studs, carSkinPreviews, selectCarSkin, buyCarSkin]);

    const mobileShopGrid = useMemo(() => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {CAR_SKINS.filter((s) => MOBILE_SKIN_IDS.has(s.id)).map(renderCarSkinCard)}
        </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [unlockedSkins, selectedSkin, isDeveloperMode, studs, carSkinPreviews, selectCarSkin, buyCarSkin]);

    const motorcycleShopGrid = useMemo(() => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {MOTORCYCLE_SKINS.map((skin) => {
                const isOwned = unlockedMotorcycleSkins.has(skin.id);
                const isSelected = selectedMotorcycleSkin === skin.id;
                const canBuy = !isOwned && (isDeveloperMode || studs >= skin.cost);
                return (
                    <div
                        key={skin.id}
                        style={{
                            background: isSelected ? '#ffd600' : isOwned ? '#1e3a5f' : '#2d2d2d',
                            border: isSelected ? '2px solid #fff176' : '2px solid transparent',
                            borderRadius: '12px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: '100px',
                            cursor: isOwned || canBuy ? 'pointer' : 'default',
                            opacity: !isOwned && !canBuy ? 0.5 : 1,
                        }}
                        onClick={() => {
                            if (isOwned) {
                                selectMotorcycleSkin(skin.id);
                            } else if (canBuy) {
                                buyMotorcycleSkin(skin.id, skin.cost);
                            }
                        }}
                    >
                        {motorcycleSkinPreviews[skin.id]}
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#1a1a1a' : 'white', textAlign: 'center' }}>{skin.label}</span>
                        {isOwned ? (
                            <span style={{ fontSize: '11px', color: isSelected ? '#555' : '#7ec8e3' }}>{isSelected ? '✓ Selected' : 'Owned'}</span>
                        ) : (
                            <span style={{ fontSize: '11px', color: '#ffd600' }}>{skin.cost} studs</span>
                        )}
                    </div>
                );
            })}
        </div>
    ), [unlockedMotorcycleSkins, selectedMotorcycleSkin, isDeveloperMode, studs, motorcycleSkinPreviews, selectMotorcycleSkin, buyMotorcycleSkin]);

    const achievementsList = useMemo(() => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = unlockedAchievements.has(ach.id);
                return (
                    <div
                        key={ach.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: isUnlocked ? 'rgba(255,214,0,0.13)' : 'rgba(255,255,255,0.05)',
                            border: isUnlocked ? '1px solid rgba(255,214,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '12px',
                        }}
                    >
                        <span style={{ fontSize: '22px', minWidth: '28px', textAlign: 'center', filter: isUnlocked ? 'none' : 'grayscale(1) opacity(0.35)' }}>{ach.emoji}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: isUnlocked ? '#ffd600' : '#888' }}>{ach.label}</span>
                            <span style={{ fontSize: '11px', color: isUnlocked ? '#ccc' : '#666' }}>{ach.desc}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isUnlocked ? '#4ade80' : '#555' }}>{isUnlocked ? '✓' : '🔒'}</span>
                    </div>
                );
            })}
        </div>
    ), [unlockedAchievements]);

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', overflow: 'hidden' }}>
            <div
                ref={canvasWrapperRef}
                style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: isFullscreen ? '100%' : '1000px',
                    maxHeight: isFullscreen ? '100vh' : '620px',
                    borderRadius: isFullscreen ? '0' : '20px',
                    overflow: 'hidden',
                    border: isFullscreen ? 'none' : '4px solid #ffcf00',
                    boxShadow: '0 18px 38px rgba(0, 0, 0, 0.14)',
                    background: '#d8f0ff',
                    position: 'relative',
                }}
            >
                <canvas
                    ref={canvasRef}
                    onPointerDown={handleCanvasPointer}
                    style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
                />
                <button
                    onClick={toggleFullscreen}
                    style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 12px', background: 'rgba(26,26,26,0.7)', color: '#ffd600', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', zIndex: 2 }}
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                    {isFullscreen ? '✕ Exit' : '⛶ Fullscreen'}
                </button>

                <button
                    onClick={toggleMusic}
                    style={{ position: 'absolute', top: '10px', right: '210px', padding: '4px 12px', background: 'rgba(26,26,26,0.7)', color: '#ffd600', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', zIndex: 2 }}
                    title={musicOn ? 'Mute music' : 'Play music'}
                >
                    {musicOn ? '🔊 Music' : '🔇 Music'}
                </button>

                <button
                    onClick={toggleSfx}
                    style={{ position: 'absolute', top: '10px', right: '310px', padding: '4px 12px', background: 'rgba(26,26,26,0.7)', color: '#ffd600', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', zIndex: 2 }}
                    title={sfxOn ? 'Mute SFX' : 'Enable SFX'}
                >
                    {sfxOn ? '🔔 SFX' : '🔕 SFX'}
                </button>

                <button
                    onClick={() => {
                        setStatsSnapshot({ ...gameStatsRef.current });
                        setShowStats((s) => !s);
                    }}
                    style={{ position: 'absolute', top: '10px', right: '110px', padding: '4px 12px', background: 'rgba(26,26,26,0.7)', color: '#ffd600', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', zIndex: 2 }}
                    title="Show stats"
                >
                    {showStats ? '✕ Stats' : '📊 Stats'}
                </button>

                {showStats && statsSnapshot && (() => {
                    const s = statsSnapshot;
                    const minutesPlayed = (s.totalPlayMs / 60000).toFixed(1);
                    const carsBroken = s.shieldKills + s.policeKills;
                    const rows: Array<[string, string | number]> = [
                        ['Total points', s.totalScore],
                        ['Minutes played', minutesPlayed],
                        ['Cars broken', carsBroken],
                        ['Total deaths', s.deaths],
                        ['Highest streak', s.highestStreak],
                    ];
                    return (
                        <div style={{ position: 'absolute', top: '48px', right: '10px', width: '240px', background: 'rgba(17,24,39,0.95)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', zIndex: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                            <span style={{ color: '#ffd600', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}>📊 Stats</span>
                            {rows.map(([label, value]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ color: '#ccc', fontSize: '13px' }}>{label}</span>
                                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {((!isGameStarted && isFirstLoad) || isGameOver) && (
                    <button
                        style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 12px', background: '#ffd600', color: '#1a1a1a', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', zIndex: 3 }}
                        onClick={() => setUi((prev) => ({ ...prev, showShop: !prev.showShop }))}
                    >
                        🧱 {showShop ? 'Close' : 'Shop'} — {isDeveloperMode ? '∞' : studs} studs
                    </button>
                )}

                {showShop && (
                    <div style={{ position: 'absolute', top: '48px', left: '10px', bottom: '10px', width: '320px', maxWidth: 'calc(100% - 20px)', background: 'rgba(17,24,39,0.95)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '12px', overflowY: 'auto', zIndex: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                        {/* Tab switcher */}
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button
                                style={{ flex: 1, padding: '8px 0', background: !showAchievements ? '#ffd600' : 'rgba(255,255,255,0.08)', color: !showAchievements ? '#1a1a1a' : '#ccc', fontWeight: 700, fontSize: '14px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                onClick={() => updateUi({ showAchievements: false })}
                            >
                                🛒 Car Shop
                            </button>
                            <button
                                style={{ flex: 1, padding: '8px 0', background: showAchievements ? '#ffd600' : 'rgba(255,255,255,0.08)', color: showAchievements ? '#1a1a1a' : '#ccc', fontWeight: 700, fontSize: '14px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                onClick={() => updateUi({ showAchievements: true })}
                            >
                                🏆 Achievements ({unlockedAchievements.size}/{ACHIEVEMENTS.length})
                            </button>
                        </div>

                        {/* Shop tab */}
                        {!showAchievements && (
                            <>
                                <span style={{ fontSize: '14px', color: '#ffd600', fontWeight: 600 }}>Your studs: {isDeveloperMode ? '∞' : studs}</span>
                                <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        style={{ padding: '6px 12px', background: shopTab === 'cars' ? '#ffd600' : 'rgba(255,255,255,0.1)', color: shopTab === 'cars' ? '#1a1a1a' : '#ddd', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                                        onClick={() => {
                                            selectedVehicleRef.current = 'car';
                                            updateUi({ shopTab: 'cars', selectedVehicle: 'car' });
                                            window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'car');
                                        }}
                                    >
                                        🚗 Cars
                                    </button>
                                    {mobilesUnlocked && (
                                        <button
                                            style={{ padding: '6px 12px', background: shopTab === 'mobiles' ? '#ffd600' : 'rgba(255,255,255,0.1)', color: shopTab === 'mobiles' ? '#1a1a1a' : '#ddd', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                                            onClick={() => {
                                                selectedVehicleRef.current = 'car';
                                                updateUi({ shopTab: 'mobiles', selectedVehicle: 'car' });
                                                window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'car');
                                            }}
                                        >
                                            🚙 Mobiles
                                        </button>
                                    )}
                                    <button
                                        style={{ padding: '6px 12px', background: shopTab === 'motorcycles' ? '#ffd600' : 'rgba(255,255,255,0.1)', color: shopTab === 'motorcycles' ? '#1a1a1a' : '#ddd', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                                        onClick={() => {
                                            selectedVehicleRef.current = 'motorcycle';
                                            updateUi({ shopTab: 'motorcycles', selectedVehicle: 'motorcycle' });
                                            window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, 'motorcycle');
                                        }}
                                    >
                                        🏍️ Motorcycles {motorcyclesUnlocked ? '' : '(Locked)'}
                                    </button>
                                </div>

                                {shopTab === 'cars' && carShopGrid}

                                {shopTab === 'mobiles' && mobilesUnlocked && mobileShopGrid}

                                {shopTab === 'motorcycles' && (
                                    <>
                                        {!motorcyclesUnlocked && (
                                            <div style={{ background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.45)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: '#ffd600', fontWeight: 700 }}>Unlock Motorcycles for 100 studs</span>
                                                <button
                                                    style={{ padding: '6px 16px', background: isDeveloperMode || studs >= 100 ? '#ffd600' : 'rgba(255,255,255,0.2)', color: isDeveloperMode || studs >= 100 ? '#1a1a1a' : '#aaa', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: isDeveloperMode || studs >= 100 ? 'pointer' : 'not-allowed' }}
                                                    onClick={unlockMotorcycles}
                                                >
                                                    Unlock 100 studs
                                                </button>
                                            </div>
                                        )}

                                        {motorcyclesUnlocked && motorcycleShopGrid}
                                    </>
                                )}
                            </>
                        )}

                        {/* Achievements tab */}
                        {showAchievements && achievementsList}
                    </div>
                )}
            </div>

            {unlockedAchievements.size >= ACHIEVEMENTS.length && (
                <span style={{ position: 'fixed', right: '16px', bottom: '16px', fontSize: '12px', color: '#666', zIndex: 2 }}>
                    Made by Christian Frederiksen
                </span>
            )}
        </div>
    );
}
