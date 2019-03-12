#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include "utility/logger.h"

#include <QMainWindow>

namespace Ui {
class MainWindow;
}

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private:
    Ui::MainWindow *ui_;

    Logger lg;
};

#endif // MAINWINDOW_H
