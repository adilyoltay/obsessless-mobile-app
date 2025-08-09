describe('Onboarding to Chat offline/online flow', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true });
  });

  it('completes onboarding and enters chat', async () => {
    await waitFor(element(by.id('onboarding-start'))).toBeVisible().withTimeout(5000);
    await element(by.id('onboarding-start')).tap();
    await waitFor(element(by.id('chat-screen'))).toBeVisible().withTimeout(10000);
  });

  it('handles offline to online transition', async () => {
    await device.setURLBlacklist(['.*']);
    await expect(element(by.text('Offline'))).toBeVisible();
    await device.setURLBlacklist([]);
    await expect(element(by.text('Offline'))).not.toBeVisible();
  });
});
