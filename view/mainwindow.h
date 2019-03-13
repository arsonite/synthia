#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include "controller/maincontroller.h"
#include "utility/logger.h"

#include <QMainWindow>
#include <QKeyEvent>

namespace Ui {
class MainWindow;
}

class MainWindow : public QMainWindow
{
Q_OBJECT
public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

    void setController(MainController *controller);

    void keyPressEvent(QKeyEvent *e) override;
    void keyReleaseEvent(QKeyEvent *e) override;

protected:
    void mousePressEvent(QMouseEvent *e);

    void mouseMoveEvent(QMouseEvent *e);

private:
    Ui::MainWindow *ui_;

    MainController *controller_;
    Logger lg;

    QPoint pos;
};

#endif // MAINWINDOW_H
