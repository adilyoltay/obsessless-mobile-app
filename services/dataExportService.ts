
import { Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CompulsionEntry } from '@/types/compulsion';

interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  dateRange: {
    start: Date;
    end: Date;
  };
  includeNotes: boolean;
  includeTrends: boolean;
  therapistInfo?: {
    name: string;
    email: string;
  };
}

interface ExportData {
  compulsions: CompulsionEntry[];
  // erpSessions: any[]; // Removed ERP
  summary: {
    totalCompulsions: number;
    avgResistance: number;
    mostCommonType: string;
    improvementTrend: string;
    keyInsights: string[];
  };
}

export class DataExportService {
  
  // Master Prompt: Kontrolü Kullanıcıya Ver - Kullanıcı hangi verileri paylaşacağına karar verir
  static async exportCompulsionData(
    compulsions: CompulsionEntry[], 
    options: ExportOptions
  ): Promise<boolean> {
    try {
      const filteredData = this.filterDataByDateRange(compulsions, options.dateRange);
      const exportData = this.prepareExportData(filteredData, options);
      
      switch (options.format) {
        case 'csv':
          return await this.exportAsCSV(exportData, options);
        case 'pdf':
          return await this.exportAsPDF(exportData, options);
        case 'json':
          return await this.exportAsJSON(exportData, options);
        default:
          throw new Error('Desteklenmeyen export formatı');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Export Hatası',
        'Veriler dışa aktarılırken bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
      return false;
    }
  }

  // Master Prompt: Empatik Dil - Terapist için anlamlı rapor oluşturma
  static async exportTherapeuticReport(
    compulsions: CompulsionEntry[],
    erpSessions: any[] = [],
    options: Partial<ExportOptions> = {}
  ): Promise<boolean> {
    const defaultOptions: ExportOptions = {
      format: 'pdf',
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date(),
      },
      includeNotes: true,
      includeTrends: true,
      ...options,
    };

    const exportData = this.prepareTherapeuticReport(compulsions, erpSessions, defaultOptions);
    
    try {
      if (defaultOptions.format === 'pdf') {
        return await this.exportTherapeuticPDF(exportData, defaultOptions);
      } else {
        return await this.exportAsCSV(exportData, defaultOptions);
      }
    } catch (error) {
      console.error('Therapeutic report export error:', error);
      return false;
    }
  }

  private static filterDataByDateRange(
    compulsions: CompulsionEntry[], 
    dateRange: { start: Date; end: Date }
  ): CompulsionEntry[] {
    return compulsions.filter(compulsion => 
      compulsion.timestamp >= dateRange.start && compulsion.timestamp <= dateRange.end
    );
  }

  private static prepareExportData(
    compulsions: CompulsionEntry[], 
    options: ExportOptions
  ): ExportData {
    // Calculate summary statistics
    const totalCompulsions = compulsions.length;
    const avgResistance = compulsions.length > 0 
      ? compulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / compulsions.length 
      : 0;

    // Find most common compulsion type
    const typeCount: { [key: string]: number } = {};
    compulsions.forEach(c => {
      typeCount[c.type] = (typeCount[c.type] || 0) + 1;
    });
    const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
      typeCount[a] > typeCount[b] ? a : b, 'Belirtilmemiş'
    );

    // Analyze improvement trend
    const recentWeek = compulsions.filter(c => 
      c.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const previousWeek = compulsions.filter(c => 
      c.timestamp >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) &&
      c.timestamp < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    let improvementTrend = 'İstikrarlı';
    if (recentWeek.length > 0 && previousWeek.length > 0) {
      const recentAvgResistance = recentWeek.reduce((sum, c) => sum + c.resistanceLevel, 0) / recentWeek.length;
      const previousAvgResistance = previousWeek.reduce((sum, c) => sum + c.resistanceLevel, 0) / previousWeek.length;
      
      if (recentAvgResistance > previousAvgResistance + 0.5) {
        improvementTrend = 'İyileşiyor';
      } else if (recentAvgResistance < previousAvgResistance - 0.5) {
        improvementTrend = 'Dikkat Gerekli';
      }
    }

    // Generate key insights for therapist
    const keyInsights: string[] = [];
    
    if (avgResistance >= 7) {
      keyInsights.push('Hasta güçlü direnç becerileri geliştirmiş');
    } else if (avgResistance >= 5) {
      keyInsights.push('Direnç becerilerinde orta seviye ilerleme');
    } else {
      keyInsights.push('Direnç becerilerinin geliştirilmesi öncelikli');
    }

    if (totalCompulsions < 10) {
      keyInsights.push('Kompulsiyon sıklığı kontrol altında');
    } else if (totalCompulsions < 20) {
      keyInsights.push('Kompulsiyon sıklığı orta seviyede');
    } else {
      keyInsights.push('Kompulsiyon sıklığında azaltma hedeflenmeli');
    }

    const morningCompulsions = compulsions.filter(c => c.timestamp.getHours() < 12).length;
    const eveningCompulsions = compulsions.filter(c => c.timestamp.getHours() >= 18).length;
    
    if (morningCompulsions > totalCompulsions * 0.6) {
      keyInsights.push('Sabah saatleri daha hassas dönem');
    } else if (eveningCompulsions > totalCompulsions * 0.6) {
      keyInsights.push('Akşam saatleri daha hassas dönem');
    }

    return {
      compulsions,
      erpSessions: [],
      summary: {
        totalCompulsions,
        avgResistance,
        mostCommonType,
        improvementTrend,
        keyInsights,
      },
    };
  }

  private static prepareTherapeuticReport(
    compulsions: CompulsionEntry[],
    erpSessions: any[],
    options: ExportOptions
  ): ExportData {
    const filteredCompulsions = this.filterDataByDateRange(compulsions, options.dateRange);
    return this.prepareExportData(filteredCompulsions, options);
  }

  private static async exportAsCSV(
    data: ExportData, 
    options: ExportOptions
  ): Promise<boolean> {
    try {
      let csvContent = 'Tarih,Saat,Kompulsiyon Tipi,Süre (dk),Direnç Seviyesi,Yoğunluk,Tetikleyici';
      
      if (options.includeNotes) {
        csvContent += ',Notlar';
      }
      
      csvContent += '\n';

      data.compulsions.forEach(compulsion => {
        const date = compulsion.timestamp.toLocaleDateString('tr-TR');
        const time = compulsion.timestamp.toLocaleTimeString('tr-TR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const triggers = (compulsion as any).triggers as string[] | undefined;
        let row = `${date},${time},${compulsion.type},${compulsion.duration},${compulsion.resistanceLevel},${compulsion.intensity},${Array.isArray(triggers) ? triggers.join(';') : ''}`;
        
        if (options.includeNotes && compulsion.notes) {
          row += `,"${compulsion.notes.replace(/"/g, '""')}"`;
        }
        
        csvContent += row + '\n';
      });

      // Add summary section
      csvContent += '\n\nÖZET RAPORU\n';
      csvContent += `Toplam Kayıt,${data.summary.totalCompulsions}\n`;
      csvContent += `Ortalama Direnç,${data.summary.avgResistance.toFixed(1)}\n`;
      csvContent += `En Sık Görülen,${data.summary.mostCommonType}\n`;
      csvContent += `İyileşme Durumu,${data.summary.improvementTrend}\n`;
      
      csvContent += '\nKLİNİK NOTLAR\n';
      data.summary.keyInsights.forEach(insight => {
        csvContent += `"${insight}"\n`;
      });

      const fileName = `obslessless_rapor_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await this.shareFile(filePath, fileName, options);
      return true;
    } catch (error) {
      console.error('CSV export error:', error);
      return false;
    }
  }

  private static async exportAsPDF(
    data: ExportData, 
    options: ExportOptions
  ): Promise<boolean> {
    // For now, we'll create a structured text report
    // In a full implementation, you'd use a PDF generation library
    try {
      let pdfContent = `
📋 OBSESSLESS HASTA RAPORU
${options.dateRange.start.toLocaleDateString('tr-TR')} - ${options.dateRange.end.toLocaleDateString('tr-TR')}

👤 HASTA BİLGİLERİ
Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}
Veri Aralığı: ${data.compulsions.length} kayıt

📊 ÖZET İSTATİSTİKLER
• Toplam Kompulsiyon: ${data.summary.totalCompulsions}
• Ortalama Direnç Seviyesi: ${data.summary.avgResistance.toFixed(1)}/10
• En Sık Görülen Tip: ${data.summary.mostCommonType}
• İyileşme Trendi: ${data.summary.improvementTrend}

🔍 KLİNİK DEĞERLENDİRME
${data.summary.keyInsights.map(insight => `• ${insight}`).join('\n')}

📈 DETAYLI VERİ ANALİZİ
`;

      // Add daily breakdown
      const dailyStats: { [key: string]: { count: number; avgResistance: number } } = {};
      
      data.compulsions.forEach(c => {
        const date = c.timestamp.toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { count: 0, avgResistance: 0 };
        }
        dailyStats[date].count += 1;
      });

      Object.keys(dailyStats).forEach(date => {
        const dayCompulsions = data.compulsions.filter(
          c => c.timestamp.toISOString().split('T')[0] === date
        );
        dailyStats[date].avgResistance = 
          dayCompulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / dayCompulsions.length;
      });

      Object.entries(dailyStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, stats]) => {
          pdfContent += `\n${new Date(date).toLocaleDateString('tr-TR')}: ${stats.count} kayıt, Ort. Direnç: ${stats.avgResistance.toFixed(1)}`;
        });

      if (options.includeNotes) {
        pdfContent += '\n\n📝 HASTA NOTLARI\n';
        data.compulsions
          .filter(c => c.notes && c.notes.trim().length > 0)
          .slice(-10) // Last 10 entries with notes
          .forEach(c => {
            pdfContent += `\n${c.timestamp.toLocaleDateString('tr-TR')} - ${c.type}: ${c.notes}`;
          });
      }

      pdfContent += '\n\n💚 Bu rapor ObsessLess uygulaması ile oluşturulmuştur.';
      pdfContent += '\nHasta takibi ve terapi planlaması amacıyla kullanılabilir.';

      const fileName = `obslessless_rapor_${new Date().toISOString().split('T')[0]}.txt`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, pdfContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await this.shareFile(filePath, fileName, options);
      return true;
    } catch (error) {
      console.error('PDF export error:', error);
      return false;
    }
  }

  private static async exportAsJSON(
    data: ExportData, 
    options: ExportOptions
  ): Promise<boolean> {
    try {
      const jsonData = {
        metadata: {
          exportDate: new Date().toISOString(),
          dateRange: {
            start: options.dateRange.start.toISOString(),
            end: options.dateRange.end.toISOString(),
          },
          appVersion: '1.0.0',
          format: 'ObsessLess Export v1',
        },
        summary: data.summary,
        compulsions: data.compulsions.map(c => ({
          id: c.id,
          timestamp: c.timestamp.toISOString(),
          type: c.type,
          duration: c.duration,
          resistanceLevel: c.resistanceLevel,
          intensity: c.intensity,
          triggers: (c as any).triggers,
          notes: options.includeNotes ? c.notes : undefined,
        })),
        erpSessions: data.erpSessions,
      };

      const fileName = `obslessless_data_${new Date().toISOString().split('T')[0]}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(jsonData, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await this.shareFile(filePath, fileName, options);
      return true;
    } catch (error) {
      console.error('JSON export error:', error);
      return false;
    }
  }

  private static async exportTherapeuticPDF(
    data: ExportData,
    options: ExportOptions
  ): Promise<boolean> {
    // Enhanced PDF for therapist with more clinical focus
    try {
      let therapeuticReport = `
🏥 KLİNİK DEĞERLENDIRME RAPORU
ObsessLess Dijital Terapötik Platform

📅 RAPOR BİLGİLERİ
Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}
Değerlendirme Süresi: ${options.dateRange.start.toLocaleDateString('tr-TR')} - ${options.dateRange.end.toLocaleDateString('tr-TR')}
Toplam Veri Noktası: ${data.compulsions.length} kayıt

${options.therapistInfo ? `Terapist: ${options.therapistInfo.name}` : ''}

🎯 KLİNİK BULGULAR

📊 Nicel Değerlendirme:
• Kompulsiyon Sıklığı: ${data.summary.totalCompulsions} kayıt
• Ortalama Direnç Kapasitesi: ${data.summary.avgResistance.toFixed(1)}/10
• Dominant Kompulsiyon: ${data.summary.mostCommonType}
• İyileşme Yönelimi: ${data.summary.improvementTrend}

🧠 Davranışsal Analiz:
${data.summary.keyInsights.map(insight => `• ${insight}`).join('\n')}

📈 İLERLEME İZLEME

Haftalık Trend Analizi:
`;

      // Weekly breakdown for clinical analysis
      const weeklyData: { [key: string]: CompulsionEntry[] } = {};
      data.compulsions.forEach(c => {
        const weekStart = new Date(c.timestamp);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = [];
        }
        weeklyData[weekKey].push(c);
      });

      Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([week, entries]) => {
          const avgResistance = entries.reduce((sum, e) => sum + e.resistanceLevel, 0) / entries.length;
          therapeuticReport += `\nHafta ${new Date(week).toLocaleDateString('tr-TR')}: ${entries.length} kayıt, Direnç: ${avgResistance.toFixed(1)}`;
        });

      therapeuticReport += '\n\n🎯 TERAPÖTİK ÖNERİLER\n';
      
      if (data.summary.avgResistance < 5) {
        therapeuticReport += '• Direnç becerilerini geliştirmeye odaklanılmalı\n';
        therapeuticReport += '• Graduated exposure tekniklerinin uygulanması önerilir\n';
      } else if (data.summary.avgResistance >= 7) {
        therapeuticReport += '• Mevcut direnç becerileri güçlü\n';
        therapeuticReport += '• Daha zorlu exposure egzersizlerine geçilebilir\n';
      }

      if (data.summary.totalCompulsions > 20) {
        therapeuticReport += '• Kompulsiyon sıklığının azaltılması priorizasyonu\n';
        therapeuticReport += '• Tetikleyici faktörlerin detaylı analizi gerekli\n';
      }

      therapeuticReport += '\n💡 Bu rapor dijital terapötik veriler üzerine oluşturulmuştur.\n';
      therapeuticReport += 'Klinik karar alma sürecinde destekleyici olarak kullanılmalıdır.\n';

      const fileName = `klinik_rapor_${new Date().toISOString().split('T')[0]}.txt`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, therapeuticReport, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await this.shareFile(filePath, fileName, options);
      return true;
    } catch (error) {
      console.error('Therapeutic PDF export error:', error);
      return false;
    }
  }

  private static async shareFile(
    filePath: string, 
    fileName: string, 
    options: ExportOptions
  ): Promise<void> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: this.getMimeType(options.format),
          dialogTitle: 'ObsessLess Raporu Paylaş',
        });
      } else {
        // Fallback to Share API
        await Share.share({
          url: filePath,
          title: 'ObsessLess Veri Raporu',
          message: `ObsessLess uygulamasından ${fileName} raporu. Bu veri terapötik amaçlarla kullanılabilir.`,
        });
      }
    } catch (error) {
      console.error('File sharing error:', error);
      Alert.alert(
        'Paylaşım Hatası',
        'Dosya paylaşılırken bir hata oluştu.',
        [{ text: 'Tamam' }]
      );
    }
  }

  private static getMimeType(format: string): string {
    switch (format) {
      case 'csv': return 'text/csv';
      case 'pdf': return 'application/pdf';
      case 'json': return 'application/json';
      default: return 'text/plain';
    }
  }

  // Quick export functions for common use cases
  static async quickExportForTherapist(compulsions: CompulsionEntry[]): Promise<boolean> {
    return this.exportTherapeuticReport(compulsions, [], {
      format: 'pdf',
      includeNotes: true,
      includeTrends: true,
    });
  }

  static async quickExportCSV(compulsions: CompulsionEntry[]): Promise<boolean> {
    return this.exportCompulsionData(compulsions, {
      format: 'csv',
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      includeNotes: false,
      includeTrends: false,
    });
  }
}
