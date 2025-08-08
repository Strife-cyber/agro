import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import styles from './api-docs.module.css'

/**
 * API DOCS LANDING PAGE
 *
 * Simple redirect page to the API documentation
 */
export default function ApiDocsLanding() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the documentation page
    router.push('/docs')
  }, [router])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.emoji}>🌾</h1>
        <h2>Redirecting to API Documentation...</h2>
        <p>If you are not redirected automatically, <Link href="/docs" className={styles.link}>click here</Link></p>
      </div>
    </div>
  )
}
