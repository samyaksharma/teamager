-- Quick check of refresh tokens
SELECT 
    rt.id,
    rt.user_id,
    rt.is_active,
    rt.expires_at,
    rt.last_used_at,
    rt.device_name,
    EXTRACT(EPOCH FROM (rt.expires_at - NOW())) / 86400 as days_until_expiry,
    u.email
FROM refresh_tokens rt
JOIN users u ON rt.user_id = u.id
WHERE rt.is_active = true AND rt.expires_at > NOW()
ORDER BY rt.last_used_at DESC;