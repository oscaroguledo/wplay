module.exports = {
  preset: '@react-native/jest-preset',
  // Shared test helpers live beside the tests but are not test files themselves.
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
};
