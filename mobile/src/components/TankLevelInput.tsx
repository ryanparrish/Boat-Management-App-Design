import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { Fuel, Droplets, Trash2 } from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'

type TankType = 'fuel' | 'water' | 'blackwater'

interface TankLevelInputProps {
  type: TankType
  value?: number
  onValueChange: (value: number) => void
  disabled?: boolean
}

const tankConfig = {
  fuel: {
    label: 'Fuel Tank',
    icon: Fuel,
    color: colors.warning,
    activeColor: '#f59e0b',
  },
  water: {
    label: 'Water Tank',
    icon: Droplets,
    color: colors.skyBlue,
    activeColor: '#0ea5e9',
  },
  blackwater: {
    label: 'Blackwater Tank',
    icon: Trash2,
    color: colors.textSecondary,
    activeColor: '#6b7280',
  },
}

const levelLabels = ['E', '¼', '½', '¾', 'F']

export function TankLevelInput({ type, value, onValueChange, disabled }: TankLevelInputProps) {
  const config = tankConfig[type]
  const Icon = config.icon

  // Default to 0 if undefined, round to nearest 10%
  const currentValue = value ?? 0
  const roundedValue = Math.round(currentValue / 10) * 10

  const getLevelLabel = (val: number): string => {
    if (val <= 10) return 'E'
    if (val <= 30) return '¼'
    if (val <= 50) return '½'
    if (val <= 70) return '¾'
    return 'F'
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon size={20} color={config.color} />
        <Text style={styles.label}>{config.label}</Text>
        <Text style={[styles.value, { color: config.activeColor }]}>
          {roundedValue}% ({getLevelLabel(roundedValue)})
        </Text>
      </View>

      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={10}
          value={roundedValue}
          onValueChange={onValueChange}
          minimumTrackTintColor={config.activeColor}
          maximumTrackTintColor={colors.slate200}
          thumbTintColor={config.activeColor}
          disabled={disabled}
        />
        <View style={styles.labels}>
          {levelLabels.map((label, index) => (
            <Text key={label} style={styles.labelText}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      {/* Visual tank indicator */}
      <View style={styles.tankVisual}>
        <View style={styles.tankOuter}>
          <View
            style={[
              styles.tankFill,
              {
                width: `${roundedValue}%`,
                backgroundColor: config.activeColor,
              },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

interface TankLevelDisplayProps {
  type: TankType
  value?: number
}

export function TankLevelDisplay({ type, value }: TankLevelDisplayProps) {
  if (value === undefined) return null

  const config = tankConfig[type]
  const Icon = config.icon

  const getLevelLabel = (val: number): string => {
    if (val <= 10) return 'Empty'
    if (val <= 30) return '¼ Full'
    if (val <= 50) return '½ Full'
    if (val <= 70) return '¾ Full'
    return 'Full'
  }

  return (
    <View style={styles.displayContainer}>
      <View style={styles.displayHeader}>
        <Icon size={16} color={config.color} />
        <Text style={styles.displayLabel}>{config.label}</Text>
      </View>
      <View style={styles.displayBar}>
        <View
          style={[
            styles.displayFill,
            {
              width: `${value}%`,
              backgroundColor: config.activeColor,
            },
          ]}
        />
      </View>
      <Text style={[styles.displayValue, { color: config.activeColor }]}>
        {value}% ({getLevelLabel(value)})
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  value: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  sliderContainer: {
    marginBottom: spacing.xs,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  labelText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  tankVisual: {
    marginTop: spacing.xs,
  },
  tankOuter: {
    height: 12,
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  tankFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  // Display styles
  displayContainer: {
    marginBottom: spacing.md,
  },
  displayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  displayLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  displayBar: {
    height: 8,
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  displayFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  displayValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'right',
  },
})
