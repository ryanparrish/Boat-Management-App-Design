/**
 * Supabase Storage Service
 * Handles vessel photo uploads and other file storage
 */

import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase/client'

const VESSEL_PHOTOS_BUCKET = 'vessel-photos'

/**
 * Pick a vessel photo from the device library
 * @returns Local URI of the selected image, or null if cancelled
 */
export async function pickVesselPhoto(): Promise<string | null> {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    
    if (!permissionResult.granted) {
      console.warn('Media library permission denied')
      return null
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })
    
    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri
    }
    
    return null
  } catch (error) {
    console.error('Error picking photo:', error)
    return null
  }
}

/**
 * Take a vessel photo with the camera
 * @returns Local URI of the captured image, or null if cancelled
 */
export async function takeVesselPhoto(): Promise<string | null> {
  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    
    if (!permissionResult.granted) {
      console.warn('Camera permission denied')
      return null
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })
    
    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri
    }
    
    return null
  } catch (error) {
    console.error('Error taking photo:', error)
    return null
  }
}

/**
 * Upload a vessel photo to Supabase storage
 * @param localUri The local file URI of the image
 * @param boatId The boat ID to associate with the photo
 * @returns Public URL of the uploaded image, or null if failed
 */
export async function uploadVesselPhoto(localUri: string, boatId: string): Promise<string | null> {
  try {
    // Generate unique filename
    const fileName = `${boatId}-${Date.now()}.jpg`
    
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    })
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(VESSEL_PHOTOS_BUCKET)
      .upload(fileName, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    
    if (error) {
      console.error('Supabase upload error:', error)
      return null
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(VESSEL_PHOTOS_BUCKET)
      .getPublicUrl(fileName)
    
    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading vessel photo:', error)
    return null
  }
}

/**
 * Delete a vessel photo from Supabase storage
 * @param photoUrl The public URL of the photo to delete
 */
export async function deleteVesselPhoto(photoUrl: string): Promise<boolean> {
  try {
    // Extract filename from URL
    const urlParts = photoUrl.split('/')
    const fileName = urlParts[urlParts.length - 1]
    
    const { error } = await supabase.storage
      .from(VESSEL_PHOTOS_BUCKET)
      .remove([fileName])
    
    if (error) {
      console.error('Error deleting photo:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error deleting vessel photo:', error)
    return false
  }
}
