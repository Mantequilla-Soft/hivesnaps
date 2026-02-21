/**
 * Mock for expo-secure-store
 */
module.exports = {
  getItemAsync: jest.fn(async (key) => {
    return null;
  }),
  setItemAsync: jest.fn(async (key, value) => {}),
  deleteItemAsync: jest.fn(async (key) => {}),
};
