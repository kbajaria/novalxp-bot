<?php
namespace local_novalxpbot;

defined('MOODLE_INTERNAL') || die();

/**
 * Builds /v1/chat payloads using Moodle context.
 */
class payload_builder {
    /**
     * @param string $question
     * @param array $history
     * @return array
     */
    public static function build(string $question, array $history = []): array {
        global $USER, $COURSE, $PAGE;

        $question = trim($question);
        $sectionid = optional_param('section', '', PARAM_RAW_TRIMMED);

        return [
            'request_id' => self::request_id(),
            'tenant_id' => 'novalxp',
            'user' => [
                'id' => (string)$USER->id,
                'role' => 'student',
                'locale' => current_language(),
            ],
            'context' => [
                'course_id' => isset($COURSE->id) ? (string)$COURSE->id : '',
                'course_name' => isset($COURSE->fullname) ? (string)$COURSE->fullname : '',
                'section_id' => (string)$sectionid,
                'section_title' => '',
                'page_type' => (string)$PAGE->pagetype,
                'current_url' => $PAGE->url->out(false),
            ],
            'query' => [
                'text' => $question,
                'history' => self::normalize_history($history),
            ],
            'options' => [
                'max_output_tokens' => 600,
                'require_citations' => true,
                'allow_model_fallback' => true,
            ],
        ];
    }

    /**
     * @return string
     */
    private static function request_id(): string {
        return bin2hex(random_bytes(16));
    }

    /**
     * @param array $history
     * @return array
     */
    private static function normalize_history(array $history): array {
        $out = [];
        foreach (array_slice($history, -20) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $role = isset($entry['role']) ? trim((string)$entry['role']) : '';
            $text = isset($entry['text']) ? trim((string)$entry['text']) : '';
            if (($role !== 'user' && $role !== 'assistant') || $text === '') {
                continue;
            }
            $out[] = ['role' => $role, 'text' => $text];
        }
        return $out;
    }
}
