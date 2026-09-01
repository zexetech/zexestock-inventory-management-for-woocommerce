<?php

defined( 'ABSPATH' ) || exit;

class ZEXST_Logger {

	const PREFIX = '[ZexeStock]';

	public static function error( string $message, array $context = array() ): void {
		self::write( 'ERROR', $message, $context );
	}

	public static function warning( string $message, array $context = array() ): void {
		self::write( 'WARNING', $message, $context );
	}

	public static function info( string $message, array $context = array() ): void {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			self::write( 'INFO', $message, $context );
		}
	}

	private static function write( string $level, string $message, array $context ): void {
		$entry = sprintf(
			'%s [%s] %s%s',
			self::PREFIX,
			$level,
			$message,
			empty( $context ) ? '' : ' ' . wp_json_encode( $context )
		);
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- this is the plugin's own logging sink, not leftover debug code.
		error_log( $entry );
	}
}
