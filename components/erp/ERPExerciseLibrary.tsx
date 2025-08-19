
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Avatar, Searchbar, List, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ERP_EXERCISES, getERPExercisesByCompulsion, EXPOSURE_CATEGORIES } from '@/constants/erpExercises';
import type { ERPLibraryExercise } from '@/constants/erpExercises';
import { CANONICAL_CATEGORIES, mapToCanonicalCategory } from '@/utils/categoryMapping';
import { getCanonicalCategoryColor, getCanonicalCategoryIconName } from '@/constants/canonicalCategories';
import { useTranslation } from '@/hooks/useTranslation';

interface ERPExerciseLibraryProps {
  onSelectExercise: (exercise: ERPLibraryExercise) => void;
  selectedCompulsionType?: string;
}

export function ERPExerciseLibrary({ onSelectExercise, selectedCompulsionType }: ERPExerciseLibraryProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [filteredExercises, setFilteredExercises] = useState<ERPLibraryExercise[]>(ERP_EXERCISES);

  useEffect(() => {
    let exercises = ERP_EXERCISES;

    // Filter by compulsion type if provided
    if (selectedCompulsionType) {
      exercises = getERPExercisesByCompulsion(selectedCompulsionType);
    }

    // Filter by canonical OCD category
    if (selectedCategory !== 'all') {
      exercises = exercises.filter(ex =>
        (ex.targetCompulsion || []).some((tc) => mapToCanonicalCategory(tc) === selectedCategory)
      );
    }

    // Filter by search query
    if (searchQuery) {
      exercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredExercises(exercises);
  }, [searchQuery, selectedCategory, selectedCompulsionType]);

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ['', 'Çok Kolay', 'Kolay', 'Orta', 'Zor', 'Çok Zor'];
    return labels[difficulty] || 'Bilinmiyor';
  };

  const getDifficultyColorByLevel = (difficulty: number) => {
    const colors = ['', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#DC2626'];
    return colors[difficulty] || '#6B7280';
  };

  const getAnxietyColor = (level: number) => {
    if (level <= 3) return '#10B981';
    if (level <= 6) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Card style={styles.headerCard} mode="elevated">
        <Card.Content>
          <View style={styles.headerContainer}>
            <Avatar.Icon size={48} icon="dumbbell" style={styles.headerIcon} />
            <View style={styles.headerText}>
              <Title style={styles.headerTitle}>ERP Egzersiz Kütüphanesi</Title>
              <Paragraph style={styles.headerSubtitle}>
                Maruz bırakma ve tepki önleme egzersizleri
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Search */}
      <Searchbar
        placeholder="Egzersiz ara..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Category Filters (Canonical OCD Categories) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
        <TouchableOpacity
          onPress={() => setSelectedCategory('all')}
          style={[
            styles.categoryChip,
            selectedCategory === 'all' && styles.selectedCategoryChip
          ]}
        >
          <Chip
            selected={selectedCategory === 'all'}
            onPress={() => setSelectedCategory('all')}
            style={styles.chip}
          >
            Tümü
          </Chip>
        </TouchableOpacity>
        {CANONICAL_CATEGORIES.map((catId) => (
          <TouchableOpacity
            key={catId}
            onPress={() => setSelectedCategory(catId)}
            style={[
              styles.categoryChip,
              selectedCategory === catId && styles.selectedCategoryChip
            ]}
          >
            <Chip
              selected={selectedCategory === catId}
              onPress={() => setSelectedCategory(catId)}
              style={styles.chip}
              icon={() => (
                <MaterialCommunityIcons
                  name={getCanonicalCategoryIconName(catId) as any}
                  size={16}
                  color={getCanonicalCategoryColor(catId)}
                />
              )}
            >
              {t('categoriesCanonical.' + catId, catId)}
            </Chip>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Exercise Stats */}
      <Card style={styles.statsCard} mode="outlined">
        <Card.Content>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{filteredExercises.length}</Text>
              <Text style={styles.statLabel}>Egzersiz</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {Math.round(filteredExercises.reduce((sum, ex) => sum + ex.duration, 0) / filteredExercises.length || 0)}
              </Text>
              <Text style={styles.statLabel}>Ort. Süre (dk)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {Math.round(filteredExercises.reduce((sum, ex) => sum + ex.difficulty, 0) / filteredExercises.length || 0)}
              </Text>
              <Text style={styles.statLabel}>Ort. Zorluk</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Exercise List */}
      <View style={styles.exerciseList}>
        {filteredExercises.map(exercise => (
          <Card key={exercise.id} style={styles.exerciseCard} mode="elevated">
            <Card.Content>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseInfo}>
                  <Title style={styles.exerciseTitle}>{exercise.name}</Title>
                  <View style={styles.exerciseMeta}>
                    <Badge 
                      style={[styles.categoryBadge, { backgroundColor: '#E5E7EB' }]}
                    >
                      {EXPOSURE_CATEGORIES[exercise.category]?.name || exercise.category}
                    </Badge>
                    <Badge 
                      style={[styles.categoryBadge, { backgroundColor: getCanonicalCategoryColor(mapToCanonicalCategory((exercise.targetCompulsion || [])[0] || 'other')) }]}
                    >
                      {t('categoriesCanonical.' + mapToCanonicalCategory((exercise.targetCompulsion || [])[0] || 'other'), 'Kategori')}
                    </Badge>
                    <Badge 
                      style={[styles.difficultyBadge, { backgroundColor: getDifficultyColorByLevel(exercise.difficulty) }]}
                    >
                      {getDifficultyLabel(exercise.difficulty)}
                    </Badge>
                  </View>
                </View>
                <Avatar.Icon 
                  size={40} 
                  icon="dumbbell" 
                  style={[styles.exerciseIcon, { backgroundColor: getDifficultyColorByLevel(exercise.difficulty) }]}
                />
              </View>

              <Paragraph style={styles.exerciseDescription}>
                {exercise.description}
              </Paragraph>

              {/* Exercise Details */}
              <View style={styles.exerciseDetails}>
                <View style={styles.detailItem}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{exercise.duration} dakika</Text>
                </View>
                <View style={styles.detailItem}>
                  <MaterialCommunityIcons name="target" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {exercise.targetCompulsion.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
                  </Text>
                </View>
              </View>

              {/* Anxiety Levels */}
              <View style={styles.anxietyContainer}>
                <Text style={styles.anxietyTitle}>Beklenen Anksiyete Seviyeleri:</Text>
                <View style={styles.anxietyLevels}>
                  <View style={styles.anxietyItem}>
                    <Text style={styles.anxietyLabel}>Başlangıç</Text>
                    <View style={[styles.anxietyIndicator, { backgroundColor: getAnxietyColor(exercise.expectedAnxiety.initial) }]}>
                      <Text style={styles.anxietyValue}>{exercise.expectedAnxiety.initial}</Text>
                    </View>
                  </View>
                  <View style={styles.anxietyItem}>
                    <Text style={styles.anxietyLabel}>Pik</Text>
                    <View style={[styles.anxietyIndicator, { backgroundColor: getAnxietyColor(exercise.expectedAnxiety.peak) }]}>
                      <Text style={styles.anxietyValue}>{exercise.expectedAnxiety.peak}</Text>
                    </View>
                  </View>
                  <View style={styles.anxietyItem}>
                    <Text style={styles.anxietyLabel}>Final</Text>
                    <View style={[styles.anxietyIndicator, { backgroundColor: getAnxietyColor(exercise.expectedAnxiety.final) }]}>
                      <Text style={styles.anxietyValue}>{exercise.expectedAnxiety.final}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Instructions Preview */}
              <List.Section style={styles.instructionsSection}>
                <List.Subheader>Talimatlar:</List.Subheader>
                {exercise.instructions.slice(0, 2).map((instruction, index) => (
                  <List.Item
                    key={index}
                    title={instruction}
                    left={() => <List.Icon icon="check-circle" />}
                    titleNumberOfLines={2}
                    style={styles.instructionItem}
                  />
                ))}
                {exercise.instructions.length > 2 && (
                  <Text style={styles.moreInstructions}>
                    +{exercise.instructions.length - 2} daha fazla adım
                  </Text>
                )}
              </List.Section>

              {/* Safety Notes */}
              {exercise.safetyNotes && exercise.safetyNotes.length > 0 && (
                <View style={styles.safetyNotesContainer}>
                  <View style={styles.safetyHeader}>
                    <MaterialCommunityIcons name="shield-alert" size={16} color="#F59E0B" />
                    <Text style={styles.safetyTitle}>Güvenlik Notları:</Text>
                  </View>
                  {exercise.safetyNotes.slice(0, 1).map((note, index) => (
                    <Text key={index} style={styles.safetyNote}>• {note}</Text>
                  ))}
                </View>
              )}

              {/* Action Button */}
              <Button
                mode="contained"
                onPress={() => onSelectExercise(exercise)}
                style={[styles.selectButton, { backgroundColor: getDifficultyColorByLevel(exercise.difficulty) }]}
                contentStyle={styles.buttonContent}
              >
                Egzersizi Başlat
              </Button>
            </Card.Content>
          </Card>
        ))}
      </View>

      {filteredExercises.length === 0 && (
        <Card style={styles.emptyCard} mode="outlined">
          <Card.Content style={styles.emptyContent}>
            <MaterialCommunityIcons name="magnify" size={48} color="#9CA3AF" />
            <Title style={styles.emptyTitle}>Egzersiz Bulunamadı</Title>
            <Paragraph style={styles.emptySubtitle}>
              Arama kriterlerinizi değiştirmeyi deneyin
            </Paragraph>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerCard: {
    margin: 16,
    marginBottom: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    backgroundColor: '#3B82F6',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  categoriesContainer: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  categoryChip: {
    marginHorizontal: 4,
  },
  selectedCategoryChip: {
    transform: [{ scale: 1.05 }],
  },
  chip: {
    marginHorizontal: 2,
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  exerciseList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  exerciseCard: {
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
  },
  exerciseIcon: {
    marginLeft: 12,
  },
  exerciseDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    color: '#4B5563',
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  anxietyContainer: {
    marginBottom: 16,
  },
  anxietyTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  anxietyLevels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  anxietyItem: {
    alignItems: 'center',
  },
  anxietyLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  anxietyIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anxietyValue: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionsSection: {
    marginBottom: 16,
  },
  instructionItem: {
    paddingVertical: 4,
  },
  moreInstructions: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#6B7280',
    paddingLeft: 16,
  },
  safetyNotesContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400E',
    marginLeft: 4,
  },
  safetyNote: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  selectButton: {
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#4B5563',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});
