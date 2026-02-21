<?php
namespace local_novalxpbot;

defined('MOODLE_INTERNAL') || die();

/**
 * Orchestrates chat request lifecycle from Moodle to backend.
 */
class service {
    /**
     * @param string $question
     * @param array $history
     * @return array
     */
    public static function chat(string $question, array $history = []): array {
        $endpoint = (string)get_config('local_novalxpbot', 'backendendpoint');
        $apikey = (string)get_config('local_novalxpbot', 'backendapikey');
        $timeout = (int)get_config('local_novalxpbot', 'requesttimeout');

        if ($endpoint === '' || $apikey === '') {
            return [
                'ok' => false,
                'error' => get_string('missingconfig', 'local_novalxpbot'),
                'status' => 500,
            ];
        }

        $payload = payload_builder::build($question, $history);
        $backendresponse = client::post_chat($endpoint, $apikey, $payload, max(5, $timeout));
        return response_formatter::format($backendresponse);
    }
}
