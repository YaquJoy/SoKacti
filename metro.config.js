const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to honour the package `exports` field.
// This makes @supabase/supabase-js resolve via its "react-native" export
// condition (→ dist/index.cjs) instead of the "import" condition
// (→ dist/index.mjs), which avoids the broken @supabase/realtime-js path.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
