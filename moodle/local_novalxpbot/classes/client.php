<?php
namespace local_novalxpbot;

defined('MOODLE_INTERNAL') || die();

/**
 * Minimal API caller stub for NovaLXP bot integration.
 */
class client {
    /**
     * @param string $endpoint
     * @param string $apikey
     * @param array $payload
     * @return array
     */
    public static function post_chat(string $endpoint, string $apikey, array $payload): array {
        $ch = curl_init($endpoint . '/v1/chat');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apikey,
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $err = curl_error($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno) {
            return [
                'ok' => false,
                'status' => 0,
                'error' => 'cURL error: ' . $err,
            ];
        }

        $decoded = json_decode($raw, true);
        return [
            'ok' => $status >= 200 && $status < 300,
            'status' => $status,
            'body' => $decoded,
            'raw' => $raw,
        ];
    }
}
