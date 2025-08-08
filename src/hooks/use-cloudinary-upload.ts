'use client'

import axios from 'axios'
import { useState } from 'react'

export interface Signature {
    apiKey: string
    signature: string
    timestamp: number
    cloudName: string
}

export function useCloudinaryUpload() {
    const [uploading, setUploading] = useState(false)
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    async function getSignature() {
        const { data } = await axios.get('/api/cloudinary-signature')
        return data as Signature
    }

    async function uploadImage(image: File | null): Promise<string | undefined> {
        if (!image) return;

        setUploading(true)

        try {
            const signature = await getSignature()

            const formData = new FormData()
            formData.append('file', image)
            formData.append('api_key', signature.apiKey)
            formData.append('timestamp', signature.timestamp.toString())
            formData.append('signature', signature.signature)
            formData.append('folder', 'agros') // Adjust folder as needed

            const url = `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`
            const response = await axios.post(url, formData)

            setImageUrl(response.data.secure_url)
            return response.data.secure_url
        } catch (error) {
            console.error('Error uploading image:', error)
            throw error
        } finally {
            setUploading(false)
        }
    }

    return { uploadImage, uploading, imageUrl }
}
