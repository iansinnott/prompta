import statsig, { type StatsigUser } from "statsig-js";

const lsKey = "feature-flags:custom";

const flagList = [
  {
    id: "vector_search_features" as const,
    name: "Semantic Search Features",
    description: `
Use semantic search to find similar messages when using the search feature. This
is a prerequisite to semantic conversation history compression. 
    `.trim(),
  },
  {
    id: "dev_experiments" as const,
    name: "Dev Experiments",
    description: `
Enables the dev experiments page. Access the page via the command menu once enabled.
  `,
  },
];

type FeatureFlag = (typeof flagList)[number];
type FlagsEnum = FeatureFlag["id"];

const user: Omit<StatsigUser, "custom"> & {
  custom: Record<string, string | number | boolean | Array<string> | undefined>;
} = {
  custom: {},
};

/**
 * Feature Flags API. Note that when reading feature flags (the `check` method),
 * the value could be stale.
 */
export const featureFlags = {
  /**
   * This is intentionally not implemented as a store
   * because feature flags may be used during the app initialization phase, which
   * requires a fresh start. After changing flags the app should be fully reloaded.
   */
  check: (flag: FlagsEnum): boolean => {
    try {
      return statsig.checkGate(flag);
    } catch (error) {
      // Ignore errors related to statsig not yet being initialized
      if (error.message.includes("wait for initialize()")) {
        console.warn(
          `Statsig not initialized but feature flag checked '${flag}'. Error follow:`,
          error
        );
        return Boolean(user.custom[flag] ?? false);
      }

      throw error;
    }
  },

  flagList,

  initialize: async (sdkKey: string, u: StatsigUser) => {
    const custom = JSON.parse(localStorage.getItem(lsKey) || "{}");
    u.custom = custom;
    Object.assign(user, u);
    const res = await statsig.initialize(sdkKey, u);
    return res;
  },

  updateUser: statsig.updateUser,

  setUser: (u: StatsigUser) => {
    Object.assign(user, u);
  },

  setFlag: (flag: FlagsEnum, value: boolean) => {
    if (!user.custom) {
      user.custom = {};
    }

    user.custom[flag] = value;
    localStorage.setItem(lsKey, JSON.stringify(user.custom));
    return statsig.updateUser(user);
  },

  getUser: () => {
    return user;
  },

  _statsig: statsig,
};
