<?php
namespace local_novalxpbot;

defined('MOODLE_INTERNAL') || die();

/**
 * Normalizes backend response for frontend rendering.
 */
class response_formatter {
    /**
     * @param array $backendresponse
     * @return array
     */
    public static function format(array $backendresponse): array {
        $body = $backendresponse['body'] ?? [];

        if (!($backendresponse['ok'] ?? false)) {
            $error = $body['error']['message'] ?? ($backendresponse['error'] ?? get_string('serviceerror', 'local_novalxpbot'));
            return [
                'ok' => false,
                'error' => $error,
                'status' => (int)($backendresponse['status'] ?? 0),
            ];
        }

        return [
            'ok' => true,
            'intent' => (string)($body['intent'] ?? 'other'),
            'text' => (string)($body['answer']['text'] ?? ''),
            'citations' => array_values($body['answer']['citations'] ?? []),
            'actions' => array_values($body['actions'] ?? []),
            'meta' => $body['meta'] ?? [],
            'request_id' => (string)($body['request_id'] ?? ''),
        ];
    }
}
