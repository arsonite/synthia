#ifndef LOGGER_H
#define LOGGER_H

#include <QString>

/**
 * When initializing and using the Logger-object in a class, the synthax of the variable name
 * against the norm by leaving aside a underscore to mark it as a class member. You should leave
 * it out, to ensure consistency throughout the application.
 *
 * @brief The Logger class
 */
class Logger
{
public:
    Logger(QString className);

    void log(QString msg) const;

private:
    std::string std(QString s) const;
    std::string getTime() const;

    const std::string className_;
};

#endif // LOGGER_H
