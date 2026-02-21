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
     * @param int $timeout
     * @return array
     */
    public static function post_chat(string $endpoint, string $apikey, array $payload, int $timeout = 20): array {
        $url = rtrim($endpoint, '/') . '/v1/chat';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apikey,
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_SLASHES));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, max(5, $timeout));

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

        $decoded = json_decode((string)$raw, true);
        if (!is_array($decoded)) {
            $decoded = [];
        }
        return [
            'ok' => $status >= 200 && $status < 300,
            'status' => $status,
            'body' => $decoded,
            'raw' => $raw,
        ];
    }
}
