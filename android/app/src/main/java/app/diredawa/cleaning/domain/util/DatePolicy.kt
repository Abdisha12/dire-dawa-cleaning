package app.diredawa.cleaning.domain.util

import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Centralized date policy for attendance and inspections (§12).
 *
 * Guidance: the app records a *calendar date* (the operational day the field user
 * is filling in). It is captured as a [LocalDate] and serialized to the backend as
 * a plain `YYYY-MM-DD` string. No local-timezone conversion is applied to the
 * chosen date, so Android cannot silently shift attendance to another day (§12).
 * The backend parses it as a PostgreSQL DATE.
 *
 * Where a "today" default is needed the device clock is used only to suggest the
 * default date; the user can change it an the chosen value is what is submitted.
 */
object DatePolicy {

    val isoFormatter: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    /** Format a [LocalDate] to the `YYYY-MM-DD` payload string. */
    fun format(date: LocalDate): String = date.format(isoFormatter)

    fun today(): LocalDate = LocalDate.now()

    fun todayIso(): String = format(today())

    /** Parse a `YYYY-MM-DD` string back to a [LocalDate]; null on malformed input. */
    fun parse(iso: String): LocalDate? = runCatching { LocalDate.parse(iso, isoFormatter) }.getOrNull()
}