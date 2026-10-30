const mockInspect = jest.fn();

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({ inspect: mockInspect })),
  },
  window: {
    createOutputChannel: jest.fn(() => ({ appendLine: jest.fn(), show: jest.fn() })),
    createStatusBarItem: jest.fn(() => ({ show: jest.fn(), hide: jest.fn() })),
  },
  StatusBarAlignment: { Left: 1 },
}), { virtual: true });

const { getSkipHostKeyVerificationHosts } = require('../../src/core/remoteFs');

describe('getSkipHostKeyVerificationHosts', () => {
  test('reads the user-level value', () => {
    mockInspect.mockReturnValue({ globalValue: ['staging.test'] });
    expect(getSkipHostKeyVerificationHosts()).toEqual(['staging.test']);
    expect(mockInspect).toHaveBeenCalledWith('skipHostKeyVerification');
  });

  test('ignores workspace and folder values', () => {
    mockInspect.mockReturnValue({
      workspaceValue: ['prod.example.com'],
      workspaceFolderValue: ['prod.example.com'],
    });
    expect(getSkipHostKeyVerificationHosts()).toEqual([]);
  });

  test('returns nothing when the setting is unset', () => {
    mockInspect.mockReturnValue(undefined);
    expect(getSkipHostKeyVerificationHosts()).toEqual([]);
  });
});
