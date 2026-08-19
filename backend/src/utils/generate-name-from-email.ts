export function generateNameFromEmail(email: string): string {
    if (!email || typeof email !== 'string') {
        return 'User'
    }

    const localPart = email.split('@')[0]

    if (!localPart) {
        return 'User'
    }

    if (localPart.includes('.')) {
        const nameParts = localPart
            .split('.')
            .map(
                (part) =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
            )
            .filter((part) => part.length > 0)

        if (nameParts.length > 0) {
            return nameParts.join(' ')
        }
    }

    if (localPart.includes('_')) {
        const nameParts = localPart
            .split('_')
            .map(
                (part) =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
            )
            .filter((part) => part.length > 0)

        if (nameParts.length > 0) {
            return nameParts.join(' ')
        }
    }

    if (localPart.includes('-')) {
        const nameParts = localPart
            .split('-')
            .map(
                (part) =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
            )
            .filter((part) => part.length > 0)

        if (nameParts.length > 0) {
            return nameParts.join(' ')
        }
    }

    return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase()
}

export function getDisplayName(
    email?: string | null,
    fallback: string = 'User',
): string {
    if (!email) {
        return fallback
    }

    return generateNameFromEmail(email)
}
