/**
 * 🧪 Quality Ribbon E2E Test Scenarios
 * Test rehberindeki tüm Quality Ribbon senaryolarını otomatize eden E2E testler
 */

import { by, device, element, expect, waitFor } from 'detox';
import { TestScenarioBuilder } from '../../__tests__/factories/testDataFactory';

describe('Quality Ribbon E2E Tests', () => {
  
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' }
    });
  });
  
  beforeEach(async () => {
    await device.reloadReactNative();
  });
  
  describe('Today Page - Quality Ribbon', () => {
    
    it('should show [Fast][Low] for new user with minimal data', async () => {
      // Yeni kullanıcı senaryosu
      await loginAsNewUser();
      
      // Today sayfasına git
      await element(by.id('tab-today')).tap();
      
      // Quality Ribbon'ın görünmesini bekle
      await waitFor(element(by.id('quality-ribbon')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Badge'leri kontrol et
      await expect(element(by.text('Fast'))).toBeVisible();
      await expect(element(by.text('Low'))).toBeVisible();
      await expect(element(by.text('n=2'))).toBeVisible();
    });
    
    it('should show [Fresh][High] after adding multiple data points', async () => {
      // Aktif kullanıcı olarak giriş yap
      await loginAsActiveUser();
      
      // Today sayfasına git
      await element(by.id('tab-today')).tap();
      
      // Veri ekle
      await addMoodEntry(8, 'Bugün kendimi iyi hissediyorum');
      await addCompulsionRecord('checking', 5);
      await addCBTRecord();
      
      // Sayfayı yenile (pull to refresh)
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Pipeline'ın tamamlanmasını bekle
      await waitFor(element(by.text('Fresh')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Quality badges kontrolü
      await expect(element(by.text('Fresh'))).toBeVisible();
      await expect(element(by.text('High'))).toBeVisible();
      await expect(element(by.text('n=15'))).toBeVisible();
    });
    
    it('should update quality ribbon when transitioning from low to high data', async () => {
      await loginAsNewUser();
      await element(by.id('tab-today')).tap();
      
      // İlk durum - Low quality
      await expect(element(by.text('Low'))).toBeVisible();
      
      // Veri eklemeye başla
      for (let i = 0; i < 10; i++) {
        await addMoodEntry(Math.floor(Math.random() * 10) + 1);
        
        // Her 3 veri noktasında quality'yi kontrol et
        if (i === 2) {
          await element(by.id('today-scroll-view')).swipe('down');
          await waitFor(element(by.text('Med')))
            .toBeVisible()
            .withTimeout(5000);
        }
      }
      
      // Son durum - High quality
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.text('High')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
  
  describe('Mood Page - Quality Ribbon', () => {
    
    it('should display quality ribbon on mood suggestion card', async () => {
      await loginAsActiveUser();
      
      // Mood sayfasına git
      await element(by.id('tab-mood')).tap();
      
      // Adaptive suggestion card'ı bekle
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Quality ribbon kontrolü
      await expect(element(by.id('quality-ribbon'))).toBeVisible();
      await expect(element(by.text('Fresh'))).toBeVisible();
      
      // Sample size kontrolü
      const sampleSizeBadge = await element(by.id('sample-size-badge')).getAttributes();
      expect(parseInt(sampleSizeBadge.text.replace('n=', ''))).toBeGreaterThan(5);
    });
    
    it('should show cache indicator when data is not fresh', async () => {
      await loginAsActiveUser();
      await element(by.id('tab-mood')).tap();
      
      // İlk yükleme - Fresh
      await waitFor(element(by.text('Fresh')))
        .toBeVisible()
        .withTimeout(5000);
      
      // 2 dakika bekle (simüle et)
      await device.setStatusBar({ time: '12:02' });
      
      // Sayfayı yeniden yükle
      await device.reloadReactNative();
      await element(by.id('tab-mood')).tap();
      
      // Cache indicator kontrolü
      await waitFor(element(by.text('Cache')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.text('Med'))).toBeVisible();
    });
  });
  
  describe('CBT Page - Analytics Integration', () => {
    
    it('should show CBT analytics in quality metadata', async () => {
      await loginAsActiveUser();
      
      // CBT sayfasına git
      await element(by.id('tab-cbt')).tap();
      
      // Yeni CBT kaydı ekle
      await element(by.id('add-cbt-button')).tap();
      await fillCBTForm({
        situation: 'Test durumu',
        moodBefore: 4,
        moodAfter: 7
      });
      await element(by.id('save-cbt-button')).tap();
      
      // Today sayfasına dön
      await element(by.id('tab-today')).tap();
      
      // Analytics'in güncellenmesini bekle
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Console log kontrolü (debug mode'da)
      // "📊 Minimal CBT analytics: sampleSize=6, volatility=0.8"
      
      // Quality ribbon'da CBT verisi olduğunu kontrol et
      await waitFor(element(by.id('quality-ribbon')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
  
  describe('Tracking Page - Pattern Recognition', () => {
    
    it('should reflect tracking patterns in quality metadata', async () => {
      await loginAsActiveUser();
      
      // Tracking sayfasına git
      await element(by.id('tab-tracking')).tap();
      
      // Birden fazla kompülsiyon kaydı ekle
      const compulsionTypes = ['checking', 'washing', 'ordering'];
      for (const type of compulsionTypes) {
        await addCompulsionRecord(type, Math.floor(Math.random() * 10) + 1);
      }
      
      // Today sayfasına git ve analizi tetikle
      await element(by.id('tab-today')).tap();
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Quality metadata'da tracking verisi kontrolü
      await waitFor(element(by.text('n=18'))) // 15 existing + 3 new
        .toBeVisible()
        .withTimeout(5000);
    });
  });
  
  describe('Cross-Page Integration', () => {
    
    it('should maintain quality consistency across pages', async () => {
      await loginAsActiveUser();
      
      // Today sayfasında quality'yi kontrol et
      await element(by.id('tab-today')).tap();
      await waitFor(element(by.id('quality-ribbon')))
        .toBeVisible()
        .withTimeout(5000);
      
      const todayQuality = await element(by.id('quality-level-badge')).getAttributes();
      
      // Mood sayfasına geç
      await element(by.id('tab-mood')).tap();
      await waitFor(element(by.id('quality-ribbon')))
        .toBeVisible()
        .withTimeout(5000);
      
      const moodQuality = await element(by.id('quality-level-badge')).getAttributes();
      
      // Quality level'ların tutarlı olduğunu kontrol et
      expect(todayQuality.text).toBe(moodQuality.text);
    });
    
    it('should handle quality evolution correctly', async () => {
      // Yeni kullanıcı ile başla
      await loginAsNewUser();
      await element(by.id('tab-today')).tap();
      
      // Başlangıç: [Fast][Low][n=2]
      await expect(element(by.text('Fast'))).toBeVisible();
      await expect(element(by.text('Low'))).toBeVisible();
      
      // Veri ekle
      for (let i = 0; i < 5; i++) {
        await addMoodEntry(5 + i);
      }
      
      // Ara durum: [Fresh][Med][n=7]
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.text('Med')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Daha fazla veri ekle
      for (let i = 0; i < 5; i++) {
        await addCompulsionRecord('checking', 3);
      }
      
      // Son durum: [Fresh][High][n=12]
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.text('High')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
  
  describe('Accessibility', () => {
    
    it('should have proper accessibility labels for quality badges', async () => {
      await loginAsActiveUser();
      await element(by.id('tab-today')).tap();
      
      // Accessibility label kontrolü
      await expect(element(by.label('AI analiz kalitesi: Yüksek'))).toBeVisible();
      await expect(element(by.label('Veri sayısı: 10'))).toBeVisible();
      await expect(element(by.label('Güncelleme zamanı: 1 dakika önce'))).toBeVisible();
    });
  });
});

// Helper Functions

async function loginAsNewUser() {
  // Test kullanıcısı oluştur ve giriş yap
  await element(by.id('test-mode-button')).tap();
  await element(by.id('create-new-user')).tap();
  await element(by.id('auto-login')).tap();
}

async function loginAsActiveUser() {
  // Aktif kullanıcı verisiyle giriş yap
  await element(by.id('test-mode-button')).tap();
  await element(by.id('load-active-user')).tap();
  await element(by.id('auto-login')).tap();
}

async function addMoodEntry(value: number, notes?: string) {
  await element(by.id('tab-mood')).tap();
  await element(by.id('add-mood-button')).tap();
  await element(by.id('mood-slider')).swipe('right', 'slow', value / 10);
  
  if (notes) {
    await element(by.id('mood-notes')).typeText(notes);
  }
  
  await element(by.id('save-mood-button')).tap();
  await waitFor(element(by.id('mood-saved-toast')))
    .toBeVisible()
    .withTimeout(2000);
}

async function addCompulsionRecord(type: string, intensity: number) {
  await element(by.id('tab-tracking')).tap();
  await element(by.id('add-compulsion-button')).tap();
  await element(by.id(`compulsion-type-${type}`)).tap();
  await element(by.id('intensity-slider')).swipe('right', 'slow', intensity / 10);
  await element(by.id('save-compulsion-button')).tap();
}

async function addCBTRecord() {
  await element(by.id('tab-cbt')).tap();
  await element(by.id('add-cbt-button')).tap();
  await fillCBTForm({
    situation: 'Test durumu',
    moodBefore: 4,
    moodAfter: 7,
    thoughts: 'Test düşüncesi'
  });
  await element(by.id('save-cbt-button')).tap();
}

async function fillCBTForm(data: any) {
  await element(by.id('cbt-situation')).typeText(data.situation);
  await element(by.id('mood-before-slider')).swipe('right', 'slow', data.moodBefore / 10);
  await element(by.id('mood-after-slider')).swipe('right', 'slow', data.moodAfter / 10);
  
  if (data.thoughts) {
    await element(by.id('cbt-thoughts')).typeText(data.thoughts);
  }
}