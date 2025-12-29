const db = require('../config/db');

const featureFlagCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const featureFlags = {
  async getFlag(featureName) {
    if (featureFlagCache.has(featureName)) {
      const cached = featureFlagCache.get(featureName);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.flag;
      }
    }

    try {
      const [flag] = await db.query(
        'SELECT * FROM feature_flags WHERE feature_name = ?',
        [featureName]
      );

      if (flag && flag.length > 0) {
        const flagData = flag[0];
        featureFlagCache.set(featureName, {
          flag: flagData,
          timestamp: Date.now()
        });
        return flagData;
      }
      return null;
    } catch (err) {
      console.error('Feature flag error:', err);
      return null;
    }
  },

  async isEnabled(featureName, userId = null) {
    const flag = await this.getFlag(featureName);
    if (!flag || !flag.is_enabled) return false;

    if (flag.rollout_percentage < 100) {
      const random = Math.floor(Math.random() * 100);
      if (random >= flag.rollout_percentage) return false;
    }

    if (userId && flag.target_user_ids) {
      const targetIds = JSON.parse(flag.target_user_ids || '[]');
      if (targetIds.length > 0 && !targetIds.includes(userId)) {
        return false;
      }
    }

    return true;
  },

  clearCache() {
    featureFlagCache.clear();
  }
};

const featureFlagsMiddleware = async (req, res, next) => {
  req.features = {
    isEnabled: (name) => featureFlags.isEnabled(name, req.user?.id)
  };
  next();
};

module.exports = {
  featureFlags,
  featureFlagsMiddleware
};
