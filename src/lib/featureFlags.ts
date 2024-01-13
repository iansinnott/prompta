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
  { id: "test flag" as const, name: "test flag" },
];

type FeatureFlag = (typeof flagList)[number];
type FlagsEnum = FeatureFlag["id"];

const user: Omit<StatsigUser, "custom"> & {
  custom: Record<string, string | number | boolean | Array<string> | undefined>;
} = {
  custom: {},
};

export const featureFlags = {
  check: (flag: FlagsEnum) => {
    return statsig.checkGate(flag);
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
